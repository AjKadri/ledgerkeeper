// Rule memory service (server only): write with key A, recall with key A or B. Newest rule wins.
import { createHash } from "node:crypto";
import type { MemWal } from "@mysten-incubation/memwal";
import type { Rule } from "./classify";
import { memoryClient, ruleFromText, ruleToText, listAll } from "./memory";

export type App = "A" | "B";

export function client(app: App, namespace: string): MemWal {
  const key = app === "A" ? process.env.MEMWAL_KEY_APP_A : process.env.MEMWAL_KEY_APP_B;
  if (!key || !process.env.MEMWAL_ACCOUNT_ID) throw new Error("Memory is not configured on the server");
  return memoryClient({ key, accountId: process.env.MEMWAL_ACCOUNT_ID, serverUrl: process.env.MEMWAL_SERVER_URL, namespace });
}

export type RuleSet = {
  rules: Rule[];                     // newest first, one per match
  blobs: Record<string, string>;     // match -> blob id of the winning rule
  recalled: number;
  listed: number;
  conflicts: { match: string; labels: string[] }[];
  incomplete: boolean;               // recall returned fewer rules than listMemories counts
};

export async function recallRules(app: App, namespace: string): Promise<RuleSet> {
  const mem = client(app, namespace);
  const listed = await listAll(mem, namespace);
  const created = new Map<string, string>(listed.map((m: any) => [m.blob_id, m.created_at]));
  let items: any[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await mem.recall({ query: "tax-rule match label", limit: 100 });
    items = res.results;
    if (items.length >= listed.length) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  const parsed = items
    .map((x) => ({ rule: ruleFromText(x.text), blob: x.blob_id as string, at: created.get(x.blob_id) ?? x.created_at ?? "" }))
    .filter((x) => x.rule) as { rule: Rule; blob: string; at: string }[];
  parsed.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)); // newest first
  const seen = new Map<string, string[]>();
  const rules: Rule[] = []; const blobs: Record<string, string> = {};
  for (const p of parsed) {
    const m = p.rule.match.toLowerCase();
    const labels = seen.get(m) ?? [];
    if (!labels.includes(p.rule.label)) labels.push(p.rule.label);
    seen.set(m, labels);
    if (labels.length === 1 && !blobs[m]) { rules.push(p.rule); blobs[m] = p.blob; }
  }
  return {
    rules, blobs, recalled: parsed.length, listed: listed.length,
    conflicts: [...seen].filter(([, l]) => l.length > 1).map(([match, labels]) => ({ match, labels })),
    incomplete: parsed.length < listed.length,
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

export async function saveRule(namespace: string, rule: Rule) {
  const gate = writesAllowed();
  if (!gate.ok) throw new Error(gate.reason);
  const text = ruleToText(rule);
  // Same namespace + same text => same key, so a double click or a retry cannot create two memories.
  const idempotencyKey = createHash("sha256").update(`${namespace}|${text}`).digest("hex").slice(0, 40);
  const res = await client("A", namespace).remember(text, { idempotencyKey });
  writeLog.push(Date.now());
  return { jobId: res.job_id, status: res.status };
}

export async function jobStatus(namespace: string, jobId: string) {
  return client("A", namespace).getRememberStatus(jobId);
}
