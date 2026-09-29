/**
 * End-to-end encryption for buyer↔seller chat (WebCrypto, no dependencies).
 *
 * Model: every user holds a P-256 ECDH identity keypair. The private key is
 * stored in this browser only, wrapped (AES-GCM) by a key derived from the
 * user's chat passphrase (PBKDF2-SHA256, 310k iterations). The public key is
 * published to the server key directory.
 *
 * Every conversation has a random 256-bit AES-GCM key, sealed per
 * participant (ephemeral ECDH → AES key-wrap) in server-side envelopes.
 * Messages and image bytes are sealed client-side; the server, admins,
 * digests and email only ever see ciphertext.
 *
 * Honest limits (documented, not hidden):
 * - Clearing browser data destroys this device's identity; history becomes
 *   unreadable here (other participants keep theirs). New devices re-key
 *   automatically when the other side sends (see ensureEnvelope).
 * - No server-side content search, moderation, or message previews.
 * - XSS on this origin could exfiltrate keys — same as session hijack.
 */

const TE = new TextEncoder();
const TD = new TextDecoder();

export function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function b64decode(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function rand(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n));
}

// Fixed 26-byte prefix of a P-256 ECDH SPKI (raw point = last 65 bytes).
const SPKI_PREFIX = "3059301306072a8648ce3d020106082a8648ce3d030107034200";

function spkiToRaw(spkiB64: string): Uint8Array {
  const spki = b64decode(spkiB64);
  if (spki.length !== 91) throw new Error("bad public key length");
  for (let i = 0; i < 26; i++) {
    if (spki[i] !== parseInt(SPKI_PREFIX.slice(i * 2, i * 2 + 2), 16)) throw new Error("bad public key header");
  }
  return spki.slice(26);
}

function rawToSpki(raw: Uint8Array): string {
  if (raw.length !== 65 || raw[0] !== 0x04) throw new Error("bad raw point");
  const prefix = new Uint8Array(26);
  for (let i = 0; i < 26; i++) prefix[i] = parseInt(SPKI_PREFIX.slice(i * 2, i * 2 + 2), 16);
  const out = new Uint8Array(91);
  out.set(prefix, 0);
  out.set(raw, 26);
  return b64encode(out);
}

async function importIdentityPublic(spkiB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("spki", b64decode(spkiB64), { name: "ECDH", namedCurve: "P-256" }, true, []);
}

async function importIdentityPrivate(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
}

async function wrapKeyFor(aesKey: CryptoKey, recipientSpkiB64: string): Promise<{ wrappedKey: string; ephemeralPub: string; nonce: string }> {
  const recipient = await importIdentityPublic(recipientSpkiB64);
  const ephemeral = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
  const ephemeralRaw = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeral.publicKey));
  const aes = await crypto.subtle.deriveKey(
    { name: "ECDH", public: recipient },
    ephemeral.privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const nonce = rand(12);
  const wrapped = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, await crypto.subtle.exportKey("raw", aesKey)));
  return { wrappedKey: b64encode(wrapped), ephemeralPub: b64encode(ephemeralRaw), nonce: b64encode(nonce) };
}

async function unwrapKeyFor(
  envelope: { wrappedKey: string; ephemeralPub: string; nonce: string },
  myPrivateKey: CryptoKey
): Promise<CryptoKey> {
  const ephemeral = await crypto.subtle.importKey(
    "raw",
    b64decode(envelope.ephemeralPub),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
  const aes = await crypto.subtle.deriveKey(
    { name: "ECDH", public: ephemeral },
    myPrivateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const raw = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64decode(envelope.nonce) },
    aes,
    b64decode(envelope.wrappedKey)
  );
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

async function importConvKey(rawB64: string, usages: KeyUsage[] = ["encrypt", "decrypt"]): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", b64decode(rawB64), { name: "AES-GCM", length: 256 }, true, usages);
}

/** Encrypt a chat text. Returns transport-ready ciphertext + nonce. */
export async function sealText(convKeyRawB64: string, plaintext: string): Promise<{ ciphertext: string; nonce: string }> {
  const key = await importConvKey(convKeyRawB64, ["encrypt"]);
  const nonce = rand(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, TE.encode(plaintext)));
  return { ciphertext: b64encode(ct), nonce: b64encode(nonce) };
}

/** Decrypt a chat text. Throws on tamper/version mismatch. */
export async function openText(convKeyRawB64: string, ciphertext: string, nonce: string): Promise<string> {
  const key = await importConvKey(convKeyRawB64, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64decode(nonce) }, key, b64decode(ciphertext));
  return TD.decode(pt);
}

/** Encrypt file bytes for upload. Caller uploads `data` and stores `nonce`. */
export async function sealFile(convKeyRawB64: string, bytes: ArrayBuffer): Promise<{ data: ArrayBuffer; nonce: string }> {
  const key = await importConvKey(convKeyRawB64, ["encrypt"]);
  const nonce = rand(12);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, bytes);
  return { data, nonce: b64encode(nonce) };
}

export async function openFile(convKeyRawB64: string, bytes: ArrayBuffer, nonce: string): Promise<ArrayBuffer> {
  const key = await importConvKey(convKeyRawB64, ["decrypt"]);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64decode(nonce) }, key, bytes);
}

// ---------------------------------------------------------------------------
// Identity + chat lock (passphrase-wrapped private key in localStorage)
// ---------------------------------------------------------------------------

export type IdentityBackup = {
  wrappedPrivate: string; // base64 AES-GCM sealed JWK
  salt: string; // base64
  iv: string; // base64
};

export type StoredIdentity = {
  publicKey: string; // base64 SPKI
  backup: IdentityBackup;
  createdAt: string;
};

const storeKey = (userId: string) => `ys.e2ee.${userId}`;
const unlocked = new Map<string, CryptoKey>(); // tab-lifetime session cache

async function pbkdf(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", TE.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function wrapPrivate(jwk: JsonWebKey, passphrase: string): Promise<IdentityBackup> {
  const salt = rand(16);
  const iv = rand(12);
  const kek = await pbkdf(passphrase, salt);
  const wrapped = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, kek, TE.encode(JSON.stringify(jwk))));
  return { wrappedPrivate: b64encode(wrapped), salt: b64encode(salt), iv: b64encode(iv) };
}

async function unwrapPrivate(backup: IdentityBackup, passphrase: string): Promise<CryptoKey> {
  const kek = await pbkdf(passphrase, b64decode(backup.salt));
  let jwk: JsonWebKey;
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64decode(backup.iv) }, kek, b64decode(backup.wrappedPrivate));
    jwk = JSON.parse(TD.decode(pt));
  } catch {
    throw new Error("Wrong passphrase.");
  }
  return importIdentityPrivate(jwk);
}

function remember(userId: string, priv: CryptoKey): void {
  unlocked.set(userId, priv);
  try {
    sessionStorage.setItem(`${storeKey(userId)}.unlocked`, "1");
  } catch {
    // private mode — module cache still works for this page load
  }
}

/**
 * First-run: generate identity, wrap the private key, persist locally.
 * Returns the public key + a server backup blob (ciphertext only).
 */
export async function createIdentity(
  userId: string,
  passphrase: string
): Promise<{ publicKey: string; backup: IdentityBackup }> {
  if (passphrase.length < 4) throw new Error("Passphrase needs 4+ characters.");
  const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
  const spki = b64encode(new Uint8Array(await crypto.subtle.exportKey("spki", kp.publicKey)));
  const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  const backup = await wrapPrivate(jwk, passphrase);
  const stored: StoredIdentity = { publicKey: spki, backup, createdAt: new Date().toISOString() };
  localStorage.setItem(storeKey(userId), JSON.stringify(stored));
  remember(userId, kp.privateKey);
  return { publicKey: spki, backup };
}

/** New device: install from the server backup blob with the same passphrase. */
export async function installIdentity(userId: string, backup: IdentityBackup, passphrase: string): Promise<string> {
  const priv = await unwrapPrivate(backup, passphrase);
  // The private JWK carries x/y — rebuild the public key to verify + persist.
  const jwk = await crypto.subtle.exportKey("jwk", priv);
  const pub = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
  const spki = b64encode(new Uint8Array(await crypto.subtle.exportKey("spki", pub)));
  const stored: StoredIdentity = { publicKey: spki, backup, createdAt: new Date().toISOString() };
  localStorage.setItem(storeKey(userId), JSON.stringify(stored));
  remember(userId, priv);
  return spki;
}

/** Unlock this device's identity for the tab session. Returns the public key. */
export async function unlockIdentity(userId: string, passphrase: string): Promise<string> {
  const raw = localStorage.getItem(storeKey(userId));
  if (!raw) throw new Error("No chat identity on this device yet.");
  const stored = JSON.parse(raw) as StoredIdentity;
  const priv = await unwrapPrivate(stored.backup, passphrase);
  remember(userId, priv);
  return stored.publicKey;
}

export function hasIdentity(userId: string): boolean {
  try {
    return !!localStorage.getItem(storeKey(userId));
  } catch {
    return false;
  }
}

/** This device's published public key (for sealing new conversation keys). */
export function getStoredPublicKey(userId: string): string | null {
  try {
    const raw = localStorage.getItem(storeKey(userId));
    if (!raw) return null;
    return (JSON.parse(raw) as StoredIdentity).publicKey ?? null;
  } catch {
    return null;
  }
}

export function isUnlocked(userId: string): boolean {
  return unlocked.has(userId);
}

export function lockIdentity(userId: string): void {
  unlocked.delete(userId);
  try {
    sessionStorage.removeItem(`${storeKey(userId)}.unlocked`);
  } catch {
    // ignore
  }
}

function myPrivate(userId: string): CryptoKey {
  const k = unlocked.get(userId);
  if (!k) throw new Error("Chat is locked — unlock first.");
  return k;
}

/** Seal a fresh conversation key for every recipient public key. */
export async function sealConversationKey(
  recipientSpkis: string[]
): Promise<{ keyRawB64: string; envelopes: Array<{ wrappedKey: string; ephemeralPub: string; nonce: string }> }> {
  const raw = rand(32);
  const key = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const keyRawB64 = b64encode(raw);
  const envelopes = [];
  for (const spki of recipientSpkis) {
    envelopes.push(await wrapKeyFor(key, spki));
  }
  return { keyRawB64, envelopes };
}

/** Open our envelope for a conversation key. */
export async function openConversationKey(
  userId: string,
  envelope: { wrappedKey: string; ephemeralPub: string; nonce: string }
): Promise<string> {
  const key = await unwrapKeyFor(envelope, myPrivate(userId));
  return b64encode(new Uint8Array(await crypto.subtle.exportKey("raw", key)));
}

/** Wrap an existing conversation key for an additional recipient (re-key). */
export async function wrapForRecipient(convKeyRawB64: string, recipientSpkiB64: string) {
  const key = await importConvKey(convKeyRawB64, ["encrypt"]);
  return wrapKeyFor(key, recipientSpkiB64);
}

export { spkiToRaw, rawToSpki };
