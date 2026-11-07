// Own-memory mode: the browser recalls its rules client-side and sends the resulting rule set along with an import.
// The server only classifies with it, so it checks the shape and sizes instead of trusting it.
import { UserError } from "./errors";
import type { RuleSet } from "./recall";

const bad = () => new UserError("The rule set sent from this browser is not valid. Reload the page and try again.");
const str = (v: unknown, max = 300): string => { if (typeof v !== "string" || v.length > max) throw bad(); return v; };
const num = (v: unknown): number => { if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1e9) throw bad(); return v; };
const arr = (v: unknown, max = 5000): unknown[] => { if (!Array.isArray(v) || v.length > max) throw bad(); return v; };
const obj = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== "object" || Array.isArray(v)) throw bad(); return v as Record<string, unknown>; };
const strMap = (v: unknown): Record<string, string> => Object.fromEntries(Object.entries(obj(v)).slice(0, 5000).map(([k, x]) => [str(k), str(x)]));

export function parseRuleSet(x: unknown): RuleSet {
  const o = obj(x);
  return {
    rules: arr(o.rules).map((r) => {
      const q = obj(r); const out: { match: string; label?: string; kind?: "own" | "exchange" | "person" } = { match: str(q.match) };
      if (q.label !== undefined) out.label = str(q.label, 40);
      if (q.kind !== undefined) { if (!["own", "exchange", "person"].includes(q.kind as string)) throw bad(); out.kind = q.kind as "own" | "exchange" | "person"; }
      if (!out.label && !out.kind) throw bad();
      return out;
    }),
    blobs: strMap(o.blobs), ats: strMap(o.ats),
    events: arr(o.events).map((e) => { const q = obj(e); return { at: str(q.at), match: str(q.match), kind: (q.kind === "updated" ? "updated" : "saved") as "saved" | "updated", value: str(q.value), from: q.from === undefined ? undefined : str(q.from), blob: str(q.blob) }; }),
    conflicts: arr(o.conflicts).map((c) => { const q = obj(c); return { match: str(q.match), labels: arr(q.labels, 50).map((l) => str(l)) }; }),
    updates: arr(o.updates).map((u) => { const q = obj(u); return { match: str(q.match), from: str(q.from), to: str(q.to) }; }),
    outcomes: arr(o.outcomes).map((x2) => { const q = obj(x2); return { wallet: str(q.wallet), range: str(q.range), txs: num(q.txs), asked: num(q.asked), answered: num(q.answered), reused: num(q.reused), blob: str(q.blob), at: str(q.at) }; }),
    recalled: num(o.recalled), listed: num(o.listed), incomplete: o.incomplete === true,
    ...(o.stale ? { stale: { at: str(obj(o.stale).at, 40) } } : {}),
  };
}
