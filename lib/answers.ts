// The answers a user can give, shared by the page and the API. Values are "kind:…" or "label:…".
import type { Kind, Rule } from "./classify";

export type Option = { value: string; text: string };

// Questions about a counterparty address describe WHO it is; the label then follows the direction.
export const COUNTERPARTY_OPTIONS: Option[] = [
  { value: "kind:own", text: "My own wallet" },
  { value: "kind:exchange", text: "An exchange" },
  { value: "kind:person", text: "A person or business" },
  { value: "label:ignore", text: "Ignore" },
];
// Questions about a contract/package describe WHAT the calls do.
export const CONTRACT_OPTIONS: Option[] = [
  { value: "label:swap", text: "Swap" },
  { value: "label:lp_add", text: "Add liquidity (LP)" },
  { value: "label:lp_remove", text: "Remove liquidity (LP)" },
  { value: "label:reward_claim", text: "Reward or fee claim" },
  { value: "kind:person", text: "Payment" },
  { value: "label:ignore", text: "Ignore" },
];

export const isContractKey = (k: string) => k.includes("::") || !k.startsWith("0x");
export const optionsFor = (k: string) => (isContractKey(k) ? CONTRACT_OPTIONS : COUNTERPARTY_OPTIONS);

export function friendly(value: string, key: string): string {
  const hit = optionsFor(key).find((o) => o.value === value);
  if (hit) return hit.text;
  const raw = value.replace(/^(kind|label):/, "");
  return raw.replace(/_/g, " ");
}

export function ruleFromValue(match: string, value: string): Rule | null {
  const [t, v] = [value.slice(0, value.indexOf(":")), value.slice(value.indexOf(":") + 1)];
  if (t === "kind" && ["own", "exchange", "person"].includes(v)) return { match, kind: v as Kind };
  if (t === "label" && /^[a-z_]{2,30}$/.test(v)) return { match, label: v };
  return null;
}
