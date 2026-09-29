import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { appendFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";

/**
 * Server-side message sealing (AES-256-GCM).
 *
 * Threat model: chat bodies travel over TLS, are sealed at rest so a bare
 * database dump exposes nothing, and are opened server-side for delivery,
 * moderation screening, notifications, and dispute transcripts. Admins and
 * trust & safety CAN read message content — this is platform-readable by
 * design (see docs in lib/chat/safety.ts).
 *
 * Keys: MESSAGE_ENCRYPTION_KEYS_JSON='{"1":"<base64 32B>",...}' with
 * MESSAGE_ENCRYPTION_KEY_ID selecting the active seal key (default "1"),
 * or legacy single MESSAGE_ENCRYPTION_KEY (id "1"). Rotation = add a new
 * id, flip the active id; old rows keep their keyId and still open.
 * In development, a missing key is generated once and appended to .env.
 */

type KeyRing = Map<string, Buffer>;

let ring: KeyRing | null = null;

function loadRing(): KeyRing {
  if (ring) return ring;
  const m = new Map<string, Buffer>();
  const multi = process.env.MESSAGE_ENCRYPTION_KEYS_JSON;
  if (multi) {
    const parsed = JSON.parse(multi) as Record<string, string>;
    for (const [id, b64] of Object.entries(parsed)) {
      const buf = Buffer.from(b64, "base64");
      if (buf.length !== 32) throw new Error(`MESSAGE_ENCRYPTION_KEYS_JSON[${id}] must be 32 bytes base64`);
      m.set(id, buf);
    }
  } else if (process.env.MESSAGE_ENCRYPTION_KEY) {
    const buf = Buffer.from(process.env.MESSAGE_ENCRYPTION_KEY, "base64");
    if (buf.length !== 32) throw new Error("MESSAGE_ENCRYPTION_KEY must be 32 bytes base64");
    m.set("1", buf);
  } else {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MESSAGE_ENCRYPTION_KEY(S_JSON) is required in production");
    }
    const fresh = randomBytes(32);
    m.set("1", fresh);
    try {
      const envPath = join(process.cwd(), ".env");
      const marker = "MESSAGE_ENCRYPTION_KEY=";
      const prev = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
      if (!prev.includes(marker)) {
        appendFileSync(envPath, `\n# Chat at-rest sealing key (auto-generated dev default)\n${marker}${fresh.toString("base64")}\n`);
      }
    } catch {
      // Ephemeral fallback — data unreadable after restart.
    }
    console.warn("[chat-crypto] generated ephemeral MESSAGE_ENCRYPTION_KEY (dev default)");
  }
  ring = m;
  return m;
}

export function activeKeyId(): string {
  loadRing();
  return process.env.MESSAGE_ENCRYPTION_KEY_ID ?? "1";
}

/** Seal plaintext. Returns transport columns for ChatMessage. */
export function seal(plaintext: string): { ciphertext: string; nonce: string; keyId: string } {
  const keys = loadRing();
  const id = activeKeyId();
  const key = keys.get(id);
  if (!key) throw new Error(`Unknown chat seal key id "${id}"`);
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([tag, ct]).toString("base64"),
    nonce: nonce.toString("base64"),
    keyId: id,
  };
}

/** Open a sealed row. Throws on tamper or unknown key. */
export function open(sealed: { ciphertext: string; nonce: string; keyId?: string | number | null }): string {
  const keys = loadRing();
  const id = String(sealed.keyId ?? "1");
  const key = keys.get(id);
  if (!key) throw new Error(`Unknown chat seal key id "${id}" — restore MESSAGE_ENCRYPTION_KEYS_JSON`);
  const raw = Buffer.from(sealed.ciphertext, "base64");
  const tag = raw.subarray(0, 16);
  const ct = raw.subarray(16);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.nonce, "base64"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/** Test helper: parse a key ring without touching process env files. */
export function parseRingForTest(json: string): Map<string, Buffer> {
  const parsed = JSON.parse(json) as Record<string, string>;
  return new Map(Object.entries(parsed).map(([id, b64]) => [id, Buffer.from(b64, "base64")]));
}
