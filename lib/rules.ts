// Rule memory service (server only): write with key A, recall with key A or B. Newest rule wins.
import { createHash } from "node:crypto";
import type { MemWal } from "@mysten-incubation/memwal";
import type { Rule } from "./classify";
import { memoryClient, ruleFromText, ruleToText, outcomeFromText, outcomeToText, listAll, type Outcome } from "./memory";
import { resolveRules, type Parsed, type Resolved, type StoredOutcome } from "./learning";

export type App = "A" | "B";

export function client(app: App, namespace: string): MemWal {
  const key = app === "A" ? process.env.MEMWAL_KEY_APP_A : process.env.MEMWAL_KEY_APP_B;
  if (!key || !process.env.MEMWAL_ACCOUNT_ID) throw new Error("Memory is not configured on the server");
  return memoryClient({ key, accountId: process.env.MEMWAL_ACCOUNT_ID, serverUrl: process.env.MEMWAL_SERVER_URL, namespace });
}

export type RuleSet = Resolved & {
  outcomes: StoredOutcome[];
  recalled: number;                  // memories recalled (rules + outcomes)
  listed: number;                    // memories listMemories counts in the namespace
  incomplete: boolean;               // recall returned fewer memories than listMemories counts
};

const QUERIES = ["tax-rule match label", "[import] wallet range txs asked answered reused"];

export async function recallRules(app: App, namespace: string): Promise<RuleSet> {
  const mem = client(app, namespace);
  const listed = await listAll(mem, namespace);
  const created = new Map<string, string>(listed.map((m: any) => [m.blob_id, m.created_at]));
  let items: any[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await Promise.all(QUERIES.map((q) => mem.recall({ query: q, limit: 100 })));
    const byBlob = new Map<string, any>();
    for (const r of res) for (const x of r.results) byBlob.set(x.blob_id, x);
    items = [...byBlob.values()];
    if (items.length >= listed.length) break;
    await new Promise((r) => setTimeout(r, 1500));
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

// --- writes: kill switch and a best-effort hourly cap (per server instance) ---
const writeLog: number[] = [];
export function writesAllowed(): { ok: boolean; reason?: string } {
  if (process.env.MEMORY_WRITES_ENABLED === "false") return { ok: false, reason: "Memory writes are switched off (read-only mode)." };
  const cap = Number(process.env.MEMORY_WRITES_PER_HOUR ?? 20);
  const now = Date.now();
  while (writeLog.length && now - writeLog[0] > 3600_000) writeLog.shift();
  if (writeLog.length >= cap) return { ok: false, reason: `Write limit reached (${cap}/hour). Try again later.` };
  return { ok: true };
}

async function write(namespace: string, text: string, actionId: string) {
  const gate = writesAllowed();
  if (!gate.ok) throw new Error(gate.reason);
  // Same action id + same text => same key, so a double click or retry cannot create two memories.
  // A new action id (a correction, even back to an old label) is a new memory and wins by created_at.
  const idempotencyKey = createHash("sha256").update(`${namespace}|${actionId}|${text}`).digest("hex").slice(0, 40);
  const res = await client("A", namespace).remember(text, { idempotencyKey });
  writeLog.push(Date.now());
  return { jobId: res.job_id, status: res.status };
}
export const saveRule = (namespace: string, rule: Rule, actionId: string) => write(namespace, ruleToText(rule), actionId);
export const saveOutcome = (namespace: string, o: Outcome, actionId: string) => write(namespace, outcomeToText(o), actionId);

export async function jobStatus(namespace: string, jobId: string) {
  return client("A", namespace).getRememberStatus(jobId);
}
