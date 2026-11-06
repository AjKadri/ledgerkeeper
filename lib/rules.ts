// Rule memory service (server only): write with key A, recall with key A or B. Newest rule wins.
import { createHash } from "node:crypto";
import type { MemWal } from "@mysten-incubation/memwal";
import type { Rule } from "./classify";
import { memoryClient, ruleToText, outcomeToText, type Outcome } from "./memory";
import { UserError } from "./errors";

export type App = "A" | "B";

export function client(app: App, namespace: string): MemWal {
  const key = app === "A" ? process.env.MEMWAL_KEY_APP_A : process.env.MEMWAL_KEY_APP_B;
  if (!key || !process.env.MEMWAL_ACCOUNT_ID) throw new Error("Memory is not configured on the server");
  return memoryClient({ key, accountId: process.env.MEMWAL_ACCOUNT_ID, serverUrl: process.env.MEMWAL_SERVER_URL, namespace });
}

import { recallWith, type RecallOpts, type RuleSet } from "./recall";
export type { RuleSet, RecallOpts };
export const recallRules = (app: App, namespace: string, opts: RecallOpts = {}): Promise<RuleSet> =>
  recallWith((opts.mem ?? client(app, namespace)) as MemWal, namespace, opts);

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

// Rules: same action id + same text => same key, so a double click or retry cannot create two memories, while a
// correction (new action id, even back to an old label) is a new memory. Outcomes pass no action id: the key comes
// from the content alone, so an identical outcome can never be stored twice.
export function idempotencyKeyFor(namespace: string, text: string, actionId?: string): string {
  return createHash("sha256").update(actionId === undefined ? `${namespace}|${text}` : `${namespace}|${actionId}|${text}`).digest("hex").slice(0, 40);
}

async function write(namespace: string, text: string, actionId?: string) {
  const gate = writesAllowed();
  if (!gate.ok) throw new UserError(gate.reason);
  const idempotencyKey = idempotencyKeyFor(namespace, text, actionId);
  const res = await client("A", namespace).remember(text, { idempotencyKey });
  writeLog.push(Date.now());
  return { jobId: res.job_id, status: res.status };
}
export const saveRule = (namespace: string, rule: Rule, actionId: string) => write(namespace, ruleToText(rule), actionId);
export const saveOutcome = (namespace: string, o: Outcome) => write(namespace, outcomeToText(o));

export async function jobStatus(namespace: string, jobId: string) {
  return client("A", namespace).getRememberStatus(jobId);
}
