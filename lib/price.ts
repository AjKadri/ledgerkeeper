// Historical SUI/USD from the Cetus SUI/USDC pool (read through Tatum GraphQL by scripts/build-prices.ts).
// The table holds one anchor per UTC day (the checkpoint nearest 12:00 UTC); a transaction's price is interpolated
// between the two anchors around its timestamp. Approximate: pool price, not a market-wide quote.
import table from "../data/sui-usd.json";

export const USD_BASIS = "approx. on-chain pool price (Cetus SUI/USDC)";
export type Anchor = { checkpoint: number; ts: string; price: number };
export type PriceTable = { prices: Record<string, Anchor> };

const sorted = (t: PriceTable) => Object.values(t.prices).map((a) => ({ t: Date.parse(a.ts), p: a.price })).sort((a, b) => a.t - b.t);
const cache = new WeakMap<PriceTable, ReturnType<typeof sorted>>();

// Price for an ISO timestamp, or null if it is more than 36 h outside the table.
export function priceAt(iso: string | null, t: PriceTable = table as PriceTable): number | null {
  if (!iso) return null;
  let a = cache.get(t); if (!a) { a = sorted(t); cache.set(t, a); }
  if (!a.length) return null;
  const x = Date.parse(iso), edge = 36 * 3600_000;
  if (x <= a[0].t) return a[0].t - x <= edge ? a[0].p : null;
  const last = a[a.length - 1];
  if (x >= last.t) return x - last.t <= edge ? last.p : null;
  let lo = 0, hi = a.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (a[m].t <= x) lo = m; else hi = m; }
  const w = (x - a[lo].t) / (a[hi].t - a[lo].t);
  return a[lo].p + (a[hi].p - a[lo].p) * w;
}
