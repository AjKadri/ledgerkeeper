// Real usage numbers for the last N hours (default 72), counted from the demo Walrus Memory account. Counts only: no
// wallet address, session id or answer is printed.
//   npx tsx scripts/usage.ts [--hours 72] [--exclude-sessions lk-aaaa,lk-bbbb] [--exclude-wallets 0x..,0x..]
// What is counted, and what is not:
//   memories stored   every memory created in the window, in any namespace of the demo account
//   questions answered rules saved (one per answer; a changed answer is a new rule)
//   wallets imported   distinct wallets in stored import outcomes. An outcome is stored when an import has nothing left
//                      to answer, so a wallet someone imported and then left is not counted: a floor, not an exact count.
//   sessions           distinct browser sessions (namespaces) that stored anything
// Own-memory (beta) users write to their own accounts, which this account cannot read, so they are not counted.
import { MemWal } from "@mysten-incubation/memwal";
import { recallWith } from "../lib/recall.ts";
import { DEMO_WALLET } from "../lib/config.ts";

try { process.loadEnvFile(".env.local"); } catch { try { process.loadEnvFile(".env"); } catch { /* use the real environment */ } }
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined; };
const hours = Number(arg("hours") ?? 72);
const exSessions = new Set((arg("exclude-sessions") ?? "").split(",").filter(Boolean));
const exWallets = new Set((arg("exclude-wallets") ?? "").split(",").filter(Boolean).map((w) => w.toLowerCase()));
const since = Date.now() - hours * 3600_000;

const key = process.env.MEMWAL_KEY_APP_A, accountId = process.env.MEMWAL_ACCOUNT_ID;
if (!key || !accountId) { console.error("MEMWAL_KEY_APP_A and MEMWAL_ACCOUNT_ID must be set."); process.exit(1); }
const mem = (namespace: string) => MemWal.create({ key, accountId, serverUrl: process.env.MEMWAL_SERVER_URL ?? "https://relayer.memory.walrus.xyz", namespace });

// 1. every memory of the account, metadata only, newest window
const all: { namespace_id: string; created_at: string }[] = [];
{
  const m = mem("default"); let cursor: string | undefined, more = true;
  while (more) { const page = await m.listMemories({ cursor, limit: 500 }); all.push(...(page.memories as any)); cursor = page.next_cursor ?? undefined; more = page.has_more; }
}
const recent = all.filter((x) => Date.parse(x.created_at) >= since);
const byNs = new Map<string, number>();
for (const x of recent) byNs.set(x.namespace_id, (byNs.get(x.namespace_id) ?? 0) + 1);

// 2. read the rules and outcomes of each active namespace (the text is only readable through recall)
let rules = 0, stored = 0; const wallets = new Set<string>(); const sessions = new Set<string>();
for (const [ns, n] of byNs) {
  if (exSessions.has(ns)) continue;
  stored += n; sessions.add(ns);
  const rs = await recallWith(mem(ns), ns);
  rules += rs.events.filter((e) => Date.parse(e.at) >= since).length;
  for (const o of rs.outcomes) if (Date.parse(o.at) >= since && !exWallets.has(o.wallet.toLowerCase())) wallets.add(o.wallet.toLowerCase());
}
console.log(`Window: last ${hours} h (since ${new Date(since).toISOString()})`);
console.log(`sessions with stored memories: ${sessions.size}`);
console.log(`memories stored:               ${stored}`);
console.log(`questions answered (rules):    ${rules}`);
console.log(`distinct wallets imported:     ${wallets.size} (floor: only imports that finished are stored)`);
console.log(`of which the sample wallet:    ${wallets.has(DEMO_WALLET) ? "yes" : "no"}`);
if (exSessions.size || exWallets.size) console.log(`excluded: ${exSessions.size} session(s), ${exWallets.size} wallet(s)`);
console.log("Own-memory (beta) accounts are private to their owners and are not counted.");
