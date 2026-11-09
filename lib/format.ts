// Small display helpers shared by the pages and components.
export const shortAddr = (a: string) => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
// 0x33ba…3209::nft  or  0x6095…449b
export const short = (k: string) =>
  k.includes("::") ? `${shortAddr(k.split("::")[0])}::${k.split("::").slice(1).join("::")}` : shortAddr(k);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const day = (iso: string) => {
  const d = new Date(iso.length === 10 ? iso + "T00:00:00Z" : iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
export const dates = (a: string, b: string) => (a === b ? day(a) : `${day(a)} – ${day(b)}`);

export function ago(iso: string, now = Date.now()): string {
  if (!iso) return "";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export const usd = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Display names for labels. The CSV keeps the raw label.
export const LABEL_NAMES: Record<string, string> = {
  own_wallet_transfer: "Own wallet",
  exchange_deposit: "Exchange deposit",
  exchange_withdrawal: "Exchange withdrawal",
  payment_sent: "Payment sent",
  payment_received: "Payment received",
  swap: "Swap",
  lp_add: "LP add",
  lp_remove: "LP remove",
  lp_compound: "LP compound",
  reward_claim: "Reward claim",
  stake: "Stake",
  unstake: "Unstake",
  stake_convert: "Stake convert",
  ignore: "Ignored",
  unknown: "Unknown",
};
export const labelName = (l: string) => LABEL_NAMES[l] ?? l.replace(/_/g, " ");

export type LabelGroup = "transfer" | "swap" | "lp" | "staking" | "reward" | "unknown";
export function labelGroup(l: string): LabelGroup {
  if (l === "unknown") return "unknown";
  if (l === "swap") return "swap";
  if (l.startsWith("lp_")) return "lp";
  if (l.startsWith("stake") || l === "unstake") return "staking";
  if (l === "reward_claim") return "reward";
  return "transfer";
}

// Pulls the rule match out of a CSV `rule_used` value ("rule: 0x…" or "built-in").
export const ruleMatch = (ruleUsed: string) => (ruleUsed.startsWith("rule: ") ? ruleUsed.slice(6) : "");

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Display-only: trims long decimals ("775.65751487 SUI" -> "775.6575 SUI"); the CSV and the title text keep the full value.
export function amountLines(text: string, sign: "+" | "\u2212"): { text: string; full: string }[] {
  if (!text) return [];
  return text.split(";").map((seg) => seg.trim()).filter(Boolean).map((seg) => {
    const raw = seg.match(/^(-?[\d.]+) \(raw ([^)]+)\) (.+)$/);            // "17452000000000 (raw GIFT) GIFT"
    if (raw) return { text: `${sign}${Number(raw[1]).toLocaleString("en-US")} ${raw[3]} (raw units)`, full: seg };
    const m = seg.match(/^(-?[\d.]+) (.+)$/);
    if (!m) return { text: `${sign}${seg}`, full: seg };
    const n = Number(m[1]);
    const digits = Math.abs(n) < 0.01 ? 6 : Math.abs(n) < 1 ? 4 : 3;
    return { text: `${sign}${n.toLocaleString("en-US", { maximumFractionDigits: digits })} ${m[2]}`, full: seg };
  });
}

// "1 call" / "2 calls", "1 transfer" / "2 transfers".
export const countNoun = (n: number, contract: boolean) => (contract ? (n === 1 ? "call" : "calls") : n === 1 ? "transfer" : "transfers");
