// Pure logic for the learning loop (no network): repeat/new counting, newest-wins, outcome lookup.
import type { Rule } from "./classify";
import type { Outcome } from "./memory";

export type Q = { key: string };
// "kind:exchange" or "label:swap": the comparable value of a rule.
export const ruleValue = (r: Rule) => (r.kind ? `kind:${r.kind}` : `label:${r.label}`);
export type Counts = { asked: number; repeat: number; new: number };

// A "repeat" question is one whose answer already exists in memory; "new" is an address/package never answered.
export function countQuestions(qs: Q[], ruleKeys: Set<string>): Counts {
  const repeat = qs.filter((q) => ruleKeys.has(q.key.toLowerCase())).length;
  return { asked: qs.length, repeat, new: qs.length - repeat };
}

export type Parsed = { rule: Rule; blob: string; at: string };
export type Resolved = {
  rules: Rule[];                                        // newest first, one per match
  blobs: Record<string, string>;                        // match -> blob of the winning rule
  conflicts: { match: string; labels: string[] }[];     // labels[0] = winner (newest)
  updates: { match: string; from: string; to: string }[];
};

// Newest created_at wins; older labels for the same match are reported as "updated from A to B".
export function resolveRules(parsed: Parsed[]): Resolved {
  const sorted = [...parsed].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const seen = new Map<string, string[]>();
  const rules: Rule[] = []; const blobs: Record<string, string> = {};
  for (const p of sorted) {
    const m = p.rule.match.toLowerCase();
    const labels = seen.get(m) ?? [];
    const v = ruleValue(p.rule);
    if (!seen.has(m)) { rules.push({ ...p.rule, match: m }); blobs[m] = p.blob; }
    if (!labels.includes(v)) labels.push(v);
    seen.set(m, labels);
  }
  const conflicts = [...seen].filter(([, l]) => l.length > 1).map(([match, labels]) => ({ match, labels }));
  return { rules, blobs, conflicts, updates: conflicts.map((c) => ({ match: c.match, from: c.labels[1], to: c.labels[0] })) };
}

export type StoredOutcome = Outcome & { blob: string; at: string };
export function latestOutcome(outcomes: StoredOutcome[], wallet: string): StoredOutcome | null {
  const mine = outcomes.filter((o) => o.wallet.toLowerCase() === wallet.toLowerCase());
  return mine.sort((a, b) => (a.at < b.at ? 1 : -1))[0] ?? null;
}
