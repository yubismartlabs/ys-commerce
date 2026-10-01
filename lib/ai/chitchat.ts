/**
 * Local chitchat/spam filter for the shopping assistant (client + server safe, no deps).
 *
 * Users type "Hello", "Who are you?", "lol", or unrelated nonsense. None of
 * that may cost a model call — answer from hardcoded text and only hit the
 * Google/HF API for legitimate product / review / order questions.
 *
 * IMPORTANT nuance vs the naive "under 3 words → chitchat" rule: step 1's own
 * example is "User asks for boots" (1 word) — a legitimate product search.
 * So short product-like queries ("boots", "red boots", "cheap phone") MUST
 * pass through to the search engine. Only messages with NO shopping intent
 * and chitchat/gibberish content are answered locally.
 */

const GREETING_RE =
  /^(hi+|hello+|hey+|hiya+|howdy|yo|sup|hola|bonjour|salut|ciao|namaste|good\s?(morning|afternoon|evening|day))(\s+(there|assistant|bot|friend|everyone|all|folks))?[\s!.,~]*$/i;

const HOW_ARE_YOU_RE = /(how are you|how'?s it going|how is it going|how do you do|how are things)/i;

const IDENTITY_RE = /(who are you|what are you|your name|about yourself|introduce yourself)/i;

const CAPABILITY_RE = /(what can you (do|help)|how can you help|how do you work|what do you do|^\s*help\s*[!?.]*\s*$)/i;

const THANKS_RE = /^(thanks|thank\s*you|thx|ty|much appreciated|appreciated)[\s!.,~]*$/i;

const BYE_RE = /^(bye+|goodbye|good\s?night|see you|see ya|later|take care)[\s!.,~]*$/i;

/** Verbs/nouns that signal a real shopping question — always let through. */
const SHOPPING_RE =
  /(\$|buy|price|cost|deal|discount|coupon|promo|cheap|afford|compare|review|rating|star|order|track|package|parcel|deliver|shipment|shipping|return|refund|exchange|stock|restock|alert|notify|watch|reorder|gift|recommend|suggest|search|find|show|looking for|need|want|flash sale|best seller)/i;

/** Single-purpose test pings and laugh-only messages. */
const FILLER_RE = /^(\s*(test|testing|tests|abc|123|ok+|k|lol|lmao|haha+h?|hehe|xd|zzz+)\s*[!?.~]*)+$/i;

function wordsOf(normalized: string): string[] {
  return normalized.split(/\s+/).filter(Boolean);
}

function hasVowel(s: string): boolean {
  return /[aeiou]/i.test(s);
}

/** Keyboard-mash sequences ("asdfgh", "qwerty") — always gibberish, never products. */
const GIBBERISH_SEQ = ["asdf", "qwer", "zxcv", "hjkl", "sdfg", "dfgh", "fghj", "ghjk", "tyui", "yuio", "jkl"];

/** Consonant-only blobs ("qwer", "bcdfg") and char spam ("aaaa", "???"). */
function isGibberish(normalized: string): boolean {
  const letters = normalized.replace(/[^a-z]/g, "");
  if (letters.length === 0) return true; // emoji / punctuation only
  if (/^(.)\1{3,}$/.test(letters)) return true; // aaaa, !!!!
  if (GIBBERISH_SEQ.some((s) => letters.includes(s))) return true; // keyboard mashes
  if (letters.length >= 4 && !hasVowel(letters)) return true; // bcdfg, qwr
  if (letters.length <= 1) return true; // "k", "?"
  return false;
}

export function tryChitchatReply(text: string, assistantName = "shopping assistant"): string | null {
  const raw = text.trim().slice(0, 500);
  if (!raw) return null;
  // Strip punctuation for matching but keep word boundaries.
  const normalized = raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'$]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "Hi! I'm your shopping assistant. What product can I help you find today?";

  if (GREETING_RE.test(raw) || GREETING_RE.test(normalized)) {
    return "Hi! I'm your shopping assistant. What product can I help you find today?";
  }
  if (HOW_ARE_YOU_RE.test(normalized)) {
    return "I'm running great and ready to shop! What product can I help you find today?";
  }
  if (IDENTITY_RE.test(normalized)) {
    return `I'm ${assistantName}, your shopping companion — I compare products, summarize reviews, check prices and track orders. What are you shopping for?`;
  }
  if (CAPABILITY_RE.test(normalized)) {
    return "I can help you find products, compare picks, summarize reviews, check deals and track orders. Tell me what you're looking for!";
  }
  if (THANKS_RE.test(raw) || THANKS_RE.test(normalized)) {
    return "You're welcome! Anything else I can help you find?";
  }
  if (BYE_RE.test(raw) || BYE_RE.test(normalized)) {
    return "Bye! I'll be here whenever you need shopping help.";
  }

  // Legitimate shopping questions always reach the engine + model.
  if (SHOPPING_RE.test(normalized)) return null;

  const words = wordsOf(normalized);

  // Short product-like queries pass through: "boots", "red boots",
  // "wireless earbuds" — the search engine (step 1) owns these.
  if (words.length <= 3 && words.every((w) => w.length >= 2 && /[a-z]/i.test(w))) {
    if (!FILLER_RE.test(normalized) && !isGibberish(normalized)) return null;
  }

  // Whatever is left and short/gibberish/filler gets the local redirect.
  if (FILLER_RE.test(normalized) || isGibberish(normalized)) {
    return "I'm your shopping assistant — I can help with products, reviews, deals and orders. What are you looking for today?";
  }
  if (words.length < 3) {
    return "Hi! I'm your shopping assistant. What product can I help you find today?";
  }

  return null;
}
