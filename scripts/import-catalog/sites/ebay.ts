import { grab, grabAll, parsePrice, politeFetch } from "../fetch";
import type { RawListing } from "../types";

/** Item ids from server-rendered search cards. */
export async function searchUrls(query: string, max: number): Promise<string[]> {
  const html = await politeFetch(
    `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_ipg=60`
  );
  const ids = new Set<string>();
  for (const m of html.matchAll(/https:\/\/www\.ebay\.com\/itm\/(\d{9,15})/g)) ids.add(m[1]);
  return [...ids].slice(0, max).map((id) => `https://www.ebay.com/itm/${id}`);
}

export function parseProduct(url: string, html: string): RawListing | null {
  const id = url.match(/\/itm\/(\d+)/)?.[1] ?? url;
  const title =
    grab(html, /<meta property="og:title" content="([^"]{5,200})"/) ??
    grab(html, /<h1[^>]*class="[^"]*x-item-title[^"]*"[^>]*>([\s\S]{1,300}?)<\/h1>/);
  if (!title) return null;
  const cleanTitle = title.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/^Details about\s+/i, "").trim().slice(0, 140);
  if (!cleanTitle) return null;

  const price =
    parsePrice(grab(html, /<meta property="og:price:amount" content="([^"]+)"/)) ??
    parsePrice(grab(html, /"price"\s*:\s*\{\s*"value"\s*:\s*"([\d.]+)"/));
  if (price == null) return null;

  const images = grabAll(html, /<meta property="og:image" content="([^"]+)"/)
    .concat(grabAll(html, /"(https:\/\/i\.ebayimg\.com\/images\/g\/[^"]+?s-l1600[^"]*)"/))
    .map((u) => u.replace(/s-l\d+/g, "s-l800"))
    .slice(0, 6);

  // Item specifics table -> specs (richest structured data of the three sites).
  const specs: RawListing["specs"] = [];
  for (const m of html.matchAll(/<dt[^>]*class="[^"]*ux-labels-values__labels[^"]*"[^>]*>\s*<span[^>]*>([^<]{1,60})<\/span>[\s\S]{0,500}?<dd[^>]*>([\s\S]{1,400}?)<\/dd>/g)) {
    const k = m[1].trim();
    const v = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
    if (k && v && specs.length < 14) specs.push({ k, v });
  }
  const brand = specs.find((s) => /^brand$/i.test(s.k))?.v?.slice(0, 40);

  const ratingAvg = Number(grab(html, /"rating"\s*:\s*"([\d.]+)"/) ?? NaN);
  const ratingCount = Number((grab(html, /"reviewCount"\s*:\s*"(\d+)"/) ?? "").replace(/,/g, "") || NaN);

  return {
    source: "ebay",
    sourceUrl: url,
    externalId: `ebay:${id}`,
    title: cleanTitle,
    price,
    images: [...new Set(images)].slice(0, 6),
    variants: [],
    specs,
    ...(brand ? { brand } : {}),
    ...(Number.isFinite(ratingAvg) && ratingAvg > 0 && ratingAvg <= 5 ? { ratingAvg } : {}),
    ...(Number.isFinite(ratingCount) && ratingCount > 0 ? { ratingCount: Math.round(ratingCount) } : {}),
  };
}

export async function fetchProduct(url: string): Promise<RawListing | null> {
  try {
    return parseProduct(url, await politeFetch(url));
  } catch {
    return null;
  }
}
