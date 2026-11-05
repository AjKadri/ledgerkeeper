// Shared classifier used by step 2 and step 3 (works on the normalised Tx shape from gql.ts).
import type { Tx } from "./gql.ts";

export type Rule = { match: string; label: string };
export type Result = { digest: string; date: string; label: string; detail: string; questionKey?: string; direction?: "in" | "out" };

const norm = (a: string | null) => (a ?? "").toLowerCase();

// 0x000…0002 -> 0x2 (applies to package ids anywhere in a string)
const shortPkg = (s: string) => s.replace(/0x0+([0-9a-f]+)(?=::)/gi, "0x$1");
// Framework helpers (0x1, 0x2, and unmatched 0x3) never describe the real action.
const isPlumbing = (call: string) => /^0x[123]::/.test(call);

// Direction from the sign of the wallet's own largest balance change.
function direction(t: Tx, wallet: string): "in" | "out" {
  const w = norm(wallet);
  let best = 0n;
  for (const b of t.balanceChanges) if (norm(b.owner) === w) { const v = BigInt(b.amount); if (v < 0n ? -v > (best < 0n ? -best : best) : v > (best < 0n ? -best : best)) best = v; }
  return best < 0n ? "out" : "in";
}

function counterparties(t: Tx, wallet: string): string[] {
  const w = norm(wallet);
  return [...new Set(t.balanceChanges.map((b) => norm(b.owner)).filter((a) => a && a !== w))];
}

export function classify(t: Tx, wallet: string, rules: Rule[] = []): Result {
  const date = (t.timestamp ?? "").slice(0, 10);
  const base = { digest: t.digest, date };
  const calls = t.calls.map(shortPkg);
  const callStr = calls.join(" ").toLowerCase();
  const meaningful = calls.filter((c) => !isPlumbing(c));
  const cps = counterparties(t, wallet);

  // 1. User rules first: an answer given once applies everywhere.
  for (const r of rules) {
    const m = r.match.toLowerCase();
    if (callStr.includes(m) || cps.includes(m)) return { ...base, label: r.label, detail: `rule: ${r.match}` };
  }

  // 2. Built-in patterns (staking first, then the generic ones)
  if (/redeem_fungible_staked_sui|request_withdraw_stake/.test(callStr)) return { ...base, label: "unstake", detail: calls.find((c) => /redeem_fungible|request_withdraw/.test(c))! };
  if (/convert_to_fungible_staked_sui|join_fungible_staked_sui/.test(callStr)) return { ...base, label: "stake_convert", detail: calls.find((c) => /convert_to_fungible|join_fungible/.test(c))! };
  if (callStr.includes("sui_system::request_add_stake")) return { ...base, label: "stake", detail: calls.find((c) => /request_add_stake/.test(c)) ?? calls[0] };
  if (callStr.includes("sui_system::request_withdraw_stake")) return { ...base, label: "unstake", detail: calls[0] };
  // Auto-compound: claim fees/rewards, swap, re-add liquidity in one tx. Not a fresh deposit.
  if (/collect_fee|collect_reward/.test(callStr) && /add_liquidity|open_position/.test(callStr) && /swap/.test(callStr))
    return { ...base, label: "lp_compound", detail: calls.find((c) => /add_liquidity|open_position/.test(c.toLowerCase())) ?? calls[0] };
  if (/add_liquidity|open_position/.test(callStr)) return { ...base, label: "lp_add", detail: calls.find((c) => /add_liquidity|open_position/.test(c.toLowerCase())) ?? calls[0] };
  if (/remove_liquidity|close_position/.test(callStr)) return { ...base, label: "lp_remove", detail: calls.find((c) => /remove_liquidity|close_position/.test(c.toLowerCase())) ?? calls[0] };
  if (/collect_fee|collect_reward|claim/.test(callStr)) return { ...base, label: "reward_claim", detail: calls.find((c) => /collect_fee|collect_reward|claim/.test(c.toLowerCase())) ?? calls[0] };
  if (/swap/.test(callStr)) return { ...base, label: "swap", detail: calls.find((c) => /swap/.test(c.toLowerCase())) ?? calls[0] };

  // 3. Unclear. Only plumbing (or nothing) left -> treat like a plain transfer.
  if (!meaningful.length) {
    const dir = direction(t, wallet);
    if (cps.length) return { ...base, label: "unknown", detail: `transfer ${dir} with ${cps[0]}${calls.length ? ` (via ${calls[0]})` : ""}`, questionKey: cps[0], direction: dir };
    return { ...base, label: "unknown", detail: `no counterparties (${dir})`, questionKey: "other", direction: dir };
  }
  const pm = meaningful[0].split("::").slice(0, 2).join("::"); // package::module
  return { ...base, label: "unknown", detail: meaningful[0], questionKey: pm };
}

export function questionsFrom(results: Result[]) {
  const groups = new Map<string, number>();
  for (const r of results) if (r.questionKey) groups.set(r.questionKey, (groups.get(r.questionKey) ?? 0) + 1);
  return [...groups.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({
      key,
      count,
      question: key.startsWith("0x") && !key.includes("::")
        ? `${count} transfers with ${key}: is this your own wallet, a person, or an exchange?`
        : `${count} calls to ${key}: what is this (swap, LP, staking, payment, other)?`,
    }));
}
