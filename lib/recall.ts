// Recall and rule-set building. No Node-only imports, so the browser (own-memory mode) uses it too.
import type { MemWal } from "@mysten-incubation/memwal";
import { ruleFromText, outcomeFromText, listAll } from "./memory";
import { resolveRules, type Parsed, type Resolved, type StoredOutcome } from "./learning";

export type RuleSet = Resolved & {
  outcomes: StoredOutcome[];
  recalled: number;                  // memories recalled (rules + outcomes)
  listed: number;                    // memories listMemories counts in the namespace
  incomplete: boolean;               // recall returned fewer memories than listMemories counts
};

const QUERIES = ["tax-rule match label", "[import] wallet range txs asked answered reused"];

export type RecallOpts = { mem?: Pick<MemWal, "recall" | "listMemories">; retryDelayMs?: number };

export async function recallWith(mem: Pick<MemWal, "recall" | "listMemories">, namespace: string, opts: Pick<RecallOpts, "retryDelayMs"> = {}): Promise<RuleSet> {
  const listed = await listAll(mem as MemWal, namespace);
  const created = new Map<string, string>(listed.map((m: any) => [m.blob_id, m.created_at]));
  let items: any[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await Promise.all(QUERIES.map((q) => mem.recall({ query: q, limit: 100 })));
    const byBlob = new Map<string, any>();
    for (const r of res) for (const x of r.results) byBlob.set(x.blob_id, x);
    items = [...byBlob.values()];
    if (items.length >= listed.length) break;
    await new Promise((r) => setTimeout(r, opts.retryDelayMs ?? 1500));
  }
  const at = (x: any) => created.get(x.blob_id) ?? x.created_at ?? "";
  const parsed = items.map((x) => ({ rule: ruleFromText(x.text), blob: x.blob_id as string, at: at(x) })).filter((x) => x.rule) as Parsed[];
  const outcomes: StoredOutcome[] = items
    .map((x) => ({ o: outcomeFromText(x.text), blob: x.blob_id as string, at: at(x) }))
    .filter((x) => x.o)
    .map((x) => ({ ...x.o!, blob: x.blob, at: x.at }));
  return {
    ...resolveRules(parsed), outcomes,
    recalled: parsed.length + outcomes.length, listed: listed.length,
    incomplete: parsed.length + outcomes.length < listed.length,
  };
}

