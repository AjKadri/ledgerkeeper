// Rule memory on Walrus Memory: one memory per rule, text form `[tax-rule] match=… label=… v=1`.
import { MemWal } from "@mysten-incubation/memwal";
import type { Rule } from "./classify";

// v2 stores either `kind=` (counterparty answers) or `label=` (contract answers). v1 (`label=… v=1`) is still read.
export const ruleToText = (r: Rule) =>
  r.kind ? `[tax-rule] match=${r.match} kind=${r.kind} v=2` : `[tax-rule] match=${r.match} label=${r.label} v=2`;

export function ruleFromText(s: string): Rule | null {
  const m = s.match(/\[tax-rule\] match=(\S+) (label|kind)=(\S+)/);
  if (!m) return null;
  if (m[2] === "kind") return ["own", "exchange", "person"].includes(m[3]) ? { match: m[1], kind: m[3] as Rule["kind"] } : null;
  return { match: m[1], label: m[3] };
}

export type MemoryConfig = { key: string; accountId: string; serverUrl?: string; namespace: string };

export function memoryClient(c: MemoryConfig): MemWal {
  return MemWal.create({
    key: c.key,
    accountId: c.accountId,
    serverUrl: c.serverUrl ?? "https://relayer.memory.walrus.xyz",
    namespace: c.namespace,
  });
}

// Exhaustive inventory (metadata only): paginate on has_more, not page length.
export async function listAll(mem: MemWal, namespace: string) {
  const all: any[] = [];
  let cursor: string | undefined;
  let more = true;
  while (more) {
    const page = await mem.listMemories({ cursor, namespace, limit: 500 });
    all.push(...page.memories);
    cursor = page.next_cursor ?? undefined;
    more = page.has_more;
  }
  return all;
}

// --- outcome memories: one per import, read back on the next import ---
export type Outcome = { wallet: string; range: string; txs: number; asked: number; answered: number; reused: number };

export const outcomeToText = (o: Outcome) =>
  `[import] wallet=${o.wallet} range=${o.range} txs=${o.txs} asked=${o.asked} answered=${o.answered} reused=${o.reused} v=1`;

export function outcomeFromText(s: string): Outcome | null {
  const m = s.match(/\[import\] wallet=(\S+) range=(\S+) txs=(\d+) asked=(\d+) answered=(\d+) reused=(\d+)/);
  return m ? { wallet: m[1], range: m[2], txs: +m[3], asked: +m[4], answered: +m[5], reused: +m[6] } : null;
}
