export const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatUSD(value: number): string {
  return USD.format(value);
}

export function discountPct(price: number, compareAt?: number): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round((1 - price / compareAt) * 100);
}

export function formatSold(sold: number): string {
  if (sold >= 1000) return `${(sold / 1000).toFixed(1).replace(/\.0$/, "")}k sold`;
  return `${sold} sold`;
}
