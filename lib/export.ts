// Labelled export. Both apps (A and B) build the CSV from here, so equal rules give equal bytes.
import type { Tx } from "./gql";
import { classify, type Rule, type Result } from "./classify";
import { priceAt, USD_BASIS, type PriceTable } from "./price";

const DECIMALS: Record<string, number> = { SUI: 9, CETUS: 9, USDC: 6, USDT: 6, WAL: 9, DEEP: 6 };
const sym = (coinType: string) => coinType.split("::").pop() ?? coinType;
const fmt = (raw: bigint, s: string) => {
  const d = DECIMALS[s]; if (d === undefined) return `${raw} (raw ${s})`;
  const neg = raw < 0n; const a = neg ? -raw : raw; const base = 10n ** BigInt(d);
  const frac = (a % base).toString().padStart(d, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${a / base}${frac ? "." + frac : ""}`;
};

export const CSV_COLUMNS = ["date", "digest", "label", "assets_in", "assets_out", "counterparty", "rule_used", "suiscan", "sui_usd_price", "usd_value", "usd_basis"] as const;

export function toRows(txs: Tx[], wallet: string, rules: Rule[], prices?: PriceTable) {
  const w = wallet.toLowerCase();
  return [...txs].sort((a, b) => (a.timestamp ?? "").localeCompare(b.timestamp ?? "") || a.digest.localeCompare(b.digest)).map((t) => {
    const r: Result = classify(t, wallet, rules);
    const mine: Record<string, bigint> = {};
    for (const b of t.balanceChanges) if ((b.owner ?? "").toLowerCase() === w) mine[sym(b.coinType)] = (mine[sym(b.coinType)] ?? 0n) + BigInt(b.amount);
    const ins = Object.entries(mine).filter(([, v]) => v > 0n).map(([s, v]) => `${fmt(v, s)} ${s}`).join("; ");
    const outs = Object.entries(mine).filter(([, v]) => v < 0n).map(([s, v]) => `${fmt(-v, s)} ${s}`).join("; ");
    const cp = [...new Set(t.balanceChanges.map((b) => (b.owner ?? "").toLowerCase()).filter((a) => a && a !== w))][0] ?? "";
    // USD: SUI legs only (net SUI change for this wallet, signed), at the pool price for the transaction time. Other coins stay blank.
    const suiNet = mine["SUI"];
    const price = suiNet !== undefined && suiNet !== 0n ? priceAt(t.timestamp, prices) : null;
    const usd = price !== null && suiNet !== undefined ? (Number(suiNet) / 1e9) * price : null;
    return {
      sui_usd_price: price !== null ? price.toFixed(4) : "",
      usd_value: usd !== null ? usd.toFixed(2) : "",
      usd_basis: usd !== null ? USD_BASIS : "",
      date: t.timestamp ?? "", digest: t.digest, label: r.label, assets_in: ins, assets_out: outs, counterparty: cp,
      rule_used: r.detail.startsWith("rule:") ? r.detail : "built-in",
      suiscan: `https://suiscan.xyz/mainnet/tx/${t.digest}`,
    };
  });
}

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export function toCsv(rows: ReturnType<typeof toRows>): string {
  return [CSV_COLUMNS.join(","), ...rows.map((r) => CSV_COLUMNS.map((c) => esc(r[c])).join(","))].join("\n") + "\n";
}
