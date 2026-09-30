/**
 * Polite fetcher: single-threaded callers, global spacing, honest identity,
 * stops at blocks. No evasion tooling by design (see README).
 */

const MIN_GAP_MS = 2500;
let lastAt = 0;

const BLOCK_MARKERS = [/captcha/i, /robot check/i, /are you a robot/i, /access denied/i, /request blocked/i];

export class BlockedError extends Error {
  constructor(public url: string, public status: number) {
    super(`blocked (${status}): ${url}`);
  }
}

export async function politeFetch(url: string): Promise<string> {
  const wait = MIN_GAP_MS - (Date.now() - lastAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastAt = Date.now();

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (res.status === 403 || res.status === 429 || res.status === 503) {
      throw new BlockedError(url, res.status);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    const html = await res.text();
    if (html.length > 4_000_000) throw new Error(`body too large: ${url}`);
    if (BLOCK_MARKERS.some((re) => re.test(html.slice(0, 200_000)))) {
      throw new BlockedError(url, 200);
    }
    return html;
  } finally {
    clearTimeout(timer);
  }
}

/** First regex group match, trimmed + entity-decoded. */
export function grab(html: string, re: RegExp): string | null {
  const m = html.match(re);
  if (!m) return null;
  return decodeEntities(m[1] ?? "").trim() || null;
}

export function grabAll(html: string, re: RegExp): string[] {
  const out: string[] = [];
  const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  for (const m of html.matchAll(global)) {
    const v = decodeEntities(m[1] ?? "").trim();
    if (v) out.push(v);
  }
  return [...new Set(out)];
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export function parsePrice(s: string | null): number | null {
  if (!s) return null;
  const m = s.replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) && v > 0 && v < 1000000 ? Math.round(v * 100) / 100 : null;
}
