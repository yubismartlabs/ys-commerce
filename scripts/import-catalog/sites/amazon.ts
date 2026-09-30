import { grab, grabAll, parsePrice, politeFetch, type BlockedError } from "../fetch";
import type { RawListing } from "../types";

const BASE = "https://www.amazon.com";

/** ASINs from a search page (data-asin + /dp/ links). */
export async function searchUrls(query: string, max: number): Promise<string[]> {
  const html = await politeFetch(`${BASE}/s?k=${encodeURIComponent(query)}`);
  const asins = new Set<string>();
  for (const m of html.matchAll(/data-asin="(B0[A-Z0-9]{8})"/g)) asins.add(m[1]);
  for (const m of html.matchAll(/\/dp\/(B0[A-Z0-9]{8})/g)) asins.add(m[1]);
  return [...asins].slice(0, max).map((a) => `${BASE}/dp/${a}`);
}

export function parseProduct(url: string, html: string): RawListing | null {
  const asin = url.match(/(B0[A-Z0-9]{8})/)?.[1] ?? url;
  const title = grab(html, /<span id="productTitle"[^>]*>([\s\S]{1,400}?)<\/span>/);
  if (!title) return null;

  const price =
    parsePrice(grab(html, /<span class="a-offscreen">([^<]{1,30})<\/span>/)) ??
    parsePrice(grab(html, /"priceToPay"[^}]*?"displayAmount"\s*:\s*"([^"]+)"/));
  if (price == null) return null;

  const wasPrice = parsePrice(grab(html, /<span class="a-price a-text-price"[\s\S]{0,300}?<span class="a-offscreen">([^<]{1,30})<\/span>/));
  const images = grabAll(html, /"hiRes"\s*:\s*"(https:\/\/m\.media-amazon\.com[^"]+)"/).slice(0, 6);
  const mainImage = grab(html, /<meta property="og:image" content="([^"]+)"/);
  if (mainImage) images.unshift(mainImage);

  // Twister variation matrix: "variationValues":{"Size":["S","M"],"Color":[...]}
  const variants: RawListing["variants"] = [];
  const twister = html.match(/"variationValues"\s*:\s*(\{[^}]{1,2000}?\})/);
  if (twister) {
    for (const vm of twister[1].matchAll(/"([^"]+)"\s*:\s*\[([^\]]{1,500}?)\]/g)) {
      for (const om of vm[2].matchAll(/"([^"]{1,60})"/g)) {
        if (variants.length < 8) variants.push({ name: `${vm[1]}: ${om[1]}` });
      }
      if (variants.length >= 8) break;
    }
  }

  // Feature bullets -> description-ish specs; detail table -> specs incl. brand.
  const bullets = grabAll(html, /<li><span class="a-list-item">([\s\S]{1,500}?)<\/span><\/li>/)
    .map((b) => b.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter((b) => b.length > 10)
    .slice(0, 6);
  const specs: RawListing["specs"] = [];
  for (const m of html.matchAll(/<tr>\s*<th[^>]*>([^<]{1,60})<\/th>\s*<td[^>]*>([\s\S]{1,300}?)<\/td>/g)) {
    const k = m[1].trim();
    const v = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
    if (k && v && specs.length < 12) specs.push({ k, v });
  }
  const brand =
    specs.find((s) => /^brand$/i.test(s.k))?.v ??
    grab(html, /<a id="bylineInfo"[^>]*>([\s\S]{1,120}?)<\/a>/)?.replace(/^(Visit the|Brand:|)\s*/i, "").replace(/\s+Store$/i, "").trim() ??
    undefined;

  return {
    source: "amazon",
    sourceUrl: url,
    externalId: `amz:${asin}`,
    title: title.replace(/\s+/g, " ").trim().slice(0, 140),
    price,
    ...(wasPrice && wasPrice > price ? { compareAt: wasPrice } : {}),
    images: [...new Set(images)].slice(0, 6),
    variants,
    specs,
    ...(brand ? { brand: brand.slice(0, 40) } : {}),
    ...(bullets.length > 0 ? { categoryHint: bullets.join(" ") } : {}),
  };
}

export async function fetchProduct(url: string): Promise<RawListing | null> {
  try {
    return parseProduct(url, await politeFetch(url));
  } catch {
    return null;
  }
}

export type { BlockedError };
