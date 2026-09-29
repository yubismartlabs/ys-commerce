/**
 * Shared chat-safety detector (client + server safe, no deps).
 *
 * Chat bodies are end-to-end encrypted, so screening runs client-side on
 * plaintext BEFORE sealing. Dispute threads are plaintext server-side, so
 * the same detector runs in API routes there. A determined attacker with a
 * custom client can bypass client checks — metadata rate limits, blocks,
 * and consent-based report evidence are the backstops.
 *
 * Levels:
 * - block: contact info, links, off-platform payment terms. Never sealed.
 * - warn:  handles + profanity. Sender confirms before sealing.
 */

export type SafetyLevel = "ok" | "warn" | "block";

export type SafetyHit = { kind: string; match: string };

export type SafetyResult = { level: SafetyLevel; hits: SafetyHit[]; message: string | null };

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+|\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:com|net|org|io|co|shop|store|me|app|dev|xyz|info|biz|us|uk|ng|in|ke|gh|za|ca|au)\b(?:\/[^\s<>"']*)?/gi;
const HANDLE_RE = /(^|\s)@[a-z0-9._]{2,30}\b/gi;

// ≥10 digits with separators — avoids order numbers, prices, quantities.
const PHONE_RE = /(\+?[\d][\d\s\-().]{6,}[\d])/g;

const CIRCUMVENTION = [
  "whatsapp",
  "telegram",
  "wechat",
  "signal app",
  "viber",
  "line app",
  "instagram",
  "off platform",
  "off-platform",
  "outside ys",
  "outside this site",
  "outside the site",
  "pay directly",
  "pay me directly",
  "bank transfer",
  "western union",
  "moneygram",
  "pay me in crypto",
  "usdt",
  "btc payment",
  "send payment to",
];

// Core English profanity (severe first). Extend per locale as needed.
const PROFANITY_SEVERE = [
  "fuck",
  "motherfucker",
  "cunt",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "whore",
  "slut",
];

const PROFANITY_MILD = [
  "shit",
  "bitch",
  "bastard",
  "asshole",
  "dick",
  "piss",
  "damn",
];

function wordRe(words: string[]): RegExp {
  return new RegExp(`\\b(${words.join("|")})(s|es|ing|ed|er|y)?\\b`, "gi");
}

function digits(s: string): number {
  return (s.match(/\d/g) ?? []).length;
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

export function detectContactInfo(text: string): SafetyHit[] {
  const hits: SafetyHit[] = [];
  for (const m of text.match(EMAIL_RE) ?? []) {
    hits.push({ kind: "email", match: m.slice(0, 40) });
  }
  for (const m of text.match(URL_RE) ?? []) {
    hits.push({ kind: "link", match: m.slice(0, 40) });
  }
  for (const m of text.match(PHONE_RE) ?? []) {
    if (digits(m) >= 10) hits.push({ kind: "phone", match: m.trim().slice(0, 24) });
  }
  return hits;
}

export function detectCircumvention(text: string): SafetyHit[] {
  const lower = ` ${text.toLowerCase()} `;
  const hits: SafetyHit[] = [];
  for (const term of CIRCUMVENTION) {
    if (lower.includes(term)) hits.push({ kind: "circumvention", match: term });
  }
  return hits;
}

export function detectProfanity(text: string): SafetyHit[] {
  const hits: SafetyHit[] = [];
  const severe = text.match(wordRe(PROFANITY_SEVERE)) ?? [];
  for (const m of uniq(severe.map((s) => s.toLowerCase()))) {
    hits.push({ kind: "profanity-severe", match: m });
  }
  const mild = text.match(wordRe(PROFANITY_MILD)) ?? [];
  for (const m of uniq(mild.map((s) => s.toLowerCase()))) {
    if (!hits.some((h) => h.match === m)) hits.push({ kind: "profanity", match: m });
  }
  // Handles (@username) — often social-media contact swaps.
  const handles = text.match(HANDLE_RE) ?? [];
  for (const m of uniq(handles.map((s) => s.trim().toLowerCase()))) {
    hits.push({ kind: "handle", match: m });
  }
  return hits;
}

/** Full screen. Pure — safe to run on every keystroke for live hints. */
export function evaluateMessage(text: string): SafetyResult {
  const trimmed = text.trim();
  if (!trimmed) return { level: "ok", hits: [], message: null };

  const contact = detectContactInfo(trimmed);
  const circumvent = detectCircumvention(trimmed);
  const profanity = detectProfanity(trimmed);

  const blockHits = [...contact, ...circumvent];
  if (blockHits.length > 0) {
    const kinds = uniq(blockHits.map((h) => h.kind)).join(", ");
    return {
      level: "block",
      hits: blockHits,
      message: `Blocked: no ${kinds} in chat. Keep deals on ys-commerce — off-platform orders lose buyer protection and seller escrow.`,
    };
  }
  if (profanity.length > 0) {
    return {
      level: "warn",
      hits: profanity,
      message: "Heads up: that looks abusive. Send anyway?",
    };
  }
  return { level: "ok", hits: [], message: null };
}
