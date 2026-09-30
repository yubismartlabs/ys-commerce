import { grab, grabAll, parsePrice, politeFetch } from "../fetch";
import type { RawListing } from "../types";

/**
 * Best-effort: AliExpress search + item pages are JS-heavy and often return
 * a shell or a block to plain fetches. Misses are recorded, never faked.
 */
export async function searchUrls(query: string, max: number): Promise<string[]> {
  const html = await politeFetch(
    `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(query)}&g=n&page=1`
  );
  const ids = new Set<string>();
  for (const m of html.matchAll(/\/item\/(\d{6,20})\.html/g)) ids.add(m[1]);
  return [...ids].slice(0, max).map((id) => `https://www.aliexpress.com/item/${id}.html`);
}

export function parseProduct(url: string, html: string): RawListing | null {
  const id = url.match(/\/item\/(\d+)\.html/)?.[1] ?? url;
  const title =
    grab(html, /"productTitle"\s*:\s*"([^"]{5,200})"/) ??
    grab(html, /<meta property="og:title" content="([^"]{5,200})"/);
  if (!title) return null;

  const price =
    parsePrice(grab(html, /"salePrice"\s*:\s*\{[^}]{0,200}?"value"\s*:\s*([\d.]+)/)) ??
    parsePrice(grab(html, /"salePrice"\s*:\s*"([\d.]+)"/)) ??
    parsePrice(grab(html, /<meta property="og:price:amount" content="([^"]+)"/));
  if (price == null) return null;

  const wasPrice = parsePrice(grab(html, /"originalPrice"\s*:\s*\{[^}]{0,200}?"value"\s*:\s*([\d.]+)/));
  const images = grabAll(html, /"(https:\/\/ae\d*\.alicdn\.com[^"]+?\.jpg[^"]*)"/)
    .map((u) => u.replace(/_\d+x\d+\.(jpg|png|webp)/, ".$1"))
    .slice(0, 6);
  const ogImage = grab(html, /<meta property="og:image" content="([^"]+)"/);
  if (ogImage) images.unshift(ogImage);

  // SKU property matrix: "skuPropertyNames":[{"propertyName":"Color",...}]
  const variants: RawListing["variants"] = [];
  for (const m of html.matchAll(/"propertyValueName"\s*:\s*"([^"]{1,60})"/g)) {
    if (variants.length < 8) variants.push({ name: m[1] });
  }

  const specs: RawListing["specs"] = [];
  for (const m of html.matchAll(/"specName"\s*:\s*"([^"]{1,60})"[^}]{0,300}?"specValue"\s*:\s*"([^"]{1,300})"/g)) {
    if (specs.length < 12) specs.push({ k: m[1], v: m[2] });
  }
  const brand =
    specs.find((s) => /^brand( name)?$/i.test(s.k))?.v?.slice(0, 40) ??
    grab(html, /"brandName"\s*:\s*"([^"]{1,40})"/) ??
    undefined;

  return {
    source: "aliexpress",
    sourceUrl: url,
    externalId: `ali:${id}`,
    title: title.replace(/\s+/g, " ").trim().slice(0, 140),
    price,
    ...(wasPrice && wasPrice > price ? { compareAt: wasPrice } : {}),
    images: [...new Set(images)].slice(0, 6),
    variants,
    specs,
    ...(brand ? { brand } : {}),
  };
}

export async function fetchProduct(url: string): Promise<RawListing | null> {
  try {
    return parseProduct(url, await politeFetch(url));
  } catch {
    return null;
  }
}
