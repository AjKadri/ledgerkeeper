// Rule memory on Walrus Memory: one memory per rule, text form `[tax-rule] match=… label=… v=1`.
import { MemWal } from "@mysten-incubation/memwal";
import type { Rule } from "./classify.ts";

export const ruleToText = (r: Rule) => `[tax-rule] match=${r.match} label=${r.label} v=1`;

export function ruleFromText(s: string): Rule | null {
  const m = s.match(/\[tax-rule\] match=(\S+) label=(\S+)/);
  return m ? { match: m[1], label: m[2] } : null;
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
