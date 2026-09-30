/**
 * Curated search queries. Amazon-only: eBay 403s plain fetches and
 * AliExpress serves a price-less CSR shell (its price API needs session
 * tokens — out of bounds for polite fetching). Both adapters stay for
 * networks where they respond; misses are recorded, never faked.
 * 12 queries x ~8 products ≈ 90 listings at full run.
 */
export const TARGETS: Array<{ site: "amazon" | "ebay" | "aliexpress"; query: string; category: string }> = [
  { site: "amazon", query: "wireless bluetooth earbuds noise cancelling", category: "electronics" },
  { site: "amazon", query: "mechanical gaming keyboard rgb", category: "electronics" },
  { site: "amazon", query: "wifi 6 mesh router", category: "electronics" },
  { site: "amazon", query: "4k action camera waterproof", category: "electronics" },
  { site: "amazon", query: "magnetic phone case iphone samsung shockproof", category: "phones" },
  { site: "amazon", query: "mens lightweight running sneakers", category: "fashion" },
  { site: "amazon", query: "womens summer floral maxi dress", category: "fashion" },
  { site: "amazon", query: "portable mini blender usb rechargeable", category: "home" },
  { site: "amazon", query: "vitamin c brightening serum hyaluronic acid", category: "beauty" },
  { site: "amazon", query: "yoga mat non slip exercise fitness", category: "sports" },
  { site: "amazon", query: "building blocks city set stem educational toy", category: "toys" },
  { site: "amazon", query: "car vacuum cleaner portable wireless handheld", category: "automotive" },
];
