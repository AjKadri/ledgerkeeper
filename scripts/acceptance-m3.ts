// M3 acceptance against any deployment:  BASE_URL=https://... npx tsx scripts/acceptance-m3.ts
import { randomBytes } from "node:crypto";
const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const W3 = "0xfee42d20b4616a1c11b1361361404dac42442b5d9be275521dba05d84a7e1342";
const W1 = "0x75b0e34aa7c9772de1d63213b323c6225548c0dd326646bd8a4ec7ee48923c2d";
const LIVE = "0x62517cd5e63cf347b2d780d6b1d338b18ea8242f8072de91ba47487c379dd4b1"; // not cached: goes live through Tatum
const ns = "lk-" + randomBytes(8).toString("hex");
const id = () => randomBytes(8).toString("hex");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);
const checks: [string, boolean][] = [];
const check = (name: string, ok: boolean) => { checks.push([name, ok]); log(ok ? "  PASS" : "  FAIL", name); };

async function api(path: string, body?: unknown) {
  const r = await fetch(BASE + path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const t = await r.text(); let j: any; try { j = JSON.parse(t); } catch { j = { raw: t }; }
  return { status: r.status, j, text: t };
}
const imp = (extra: object, address = W3) => api("/api/import", { address, namespace: ns, ...extra }).then((r) => { if (r.status !== 200) throw new Error(r.j.error); return r.j; });
async function waitJob(jobId: string) {
  for (let i = 0; i < 60; i++) {
    const s = (await api(`/api/job?namespace=${ns}&id=${jobId}`)).j;
    if (s.status === "done") return s.blob_id as string;
    if (s.status === "failed") throw new Error("job failed " + s.error);
    await sleep(3000);
  }
  throw new Error("timeout");
}
async function answerAll(qs: any[], pickLabel: (q: any) => string) {
  const jobs = [];
  for (const q of qs) jobs.push((await api("/api/answer", { namespace: ns, match: q.key, value: pickLabel(q), answerId: id() })).j.jobId);
  for (const j of jobs) await waitJob(j);
}
const outcome = async (i: any, answered: number, range: string) =>
  waitJob((await api("/api/outcome", { namespace: ns, address: i.address, range, txs: i.txCount, asked: i.counts.on.asked, answered, reused: i.reused, outcomeId: id() })).j.jobId);
// Counterparty questions describe who it is; contract questions are ignored in this demo run.
const lab = (q: any) => (!q.key.startsWith("0x") || q.key.includes("::") ? "label:ignore" : "kind:person");

log("target", BASE, "namespace", ns);

log("== wallet3 import 1 (to 30 Jun)");
const i1 = await imp({ to: "2026-06-30" });
log(`  ${i1.txCount} txs, ${i1.source}${i1.cachedAt ? " cached at " + i1.cachedAt : ""}; asked ${i1.counts.on.asked} (repeat ${i1.counts.on.repeat}, new ${i1.counts.on.new})`);
check("import 1 has questions, none repeat", i1.counts.on.asked > 0 && i1.counts.on.repeat === 0);
await answerAll(i1.questions, lab);
log(`  answered ${i1.questions.length}, all saved`);
const ob1 = await outcome(i1, i1.questions.length, "start..2026-06-30"); log("  outcome 1 saved, blob", ob1);

await sleep(3000);
log("== wallet3 import 2 (Jul-Aug)");
const i2 = await imp({ from: "2026-07-01", to: "2026-08-31" });
log(`  ${i2.txCount} txs. Repeat questions: ${i2.counts.on.repeat} with memory / ${i2.counts.off.repeat} without. New: ${i2.counts.on.new}. Asked ON ${i2.counts.on.asked} / OFF ${i2.counts.off.asked}`);
check("import 2: 0 repeat with memory", i2.counts.on.repeat === 0);
check("import 2: >0 repeat without memory", i2.counts.off.repeat > 0);
log(`  last time: ${JSON.stringify(i2.previousOutcome)}`);
check("previous outcome shown (answered = import 1 answers)", i2.previousOutcome?.answered === i1.questions.length);
log(`  UI line: "Last time (${i2.previousOutcome?.range}) you answered ${i2.previousOutcome?.answered} of ${i2.previousOutcome?.asked}. This time: ${i2.counts.on.new} new, ${i2.reused} reused from memory."`);
const offView = await imp({ from: "2026-07-01", to: "2026-08-31", memory: false });
check("toggle OFF shows the same import's repeat questions", offView.questions.length === i2.counts.off.asked);
await answerAll(i2.questions, lab);
const ob2 = await outcome(i2, i2.questions.length, "2026-07-01..2026-08-31"); log("  import 2 answered, outcome 2 saved, blob", ob2);

log("== correction");
const target = i1.questions.find((q: any) => q.key.startsWith("0x") && !q.key.includes("::"))!;
const oldLabel = "kind:person", newLabel = "kind:exchange";
const t0 = Date.now();
await waitJob((await api("/api/answer", { namespace: ns, match: target.key, value: newLabel, answerId: id() })).j.jobId);
log(`  corrected ${target.key.slice(0, 14)}… ${oldLabel} -> ${newLabel} (saved in ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
await sleep(3000);
const i3 = await imp({});
const upd = i3.updates.find((u: any) => u.match === target.key.toLowerCase());
log(`  re-import updates: ${JSON.stringify(i3.updates)}`);
check(`"updated from ${oldLabel} to ${newLabel}" reported`, upd?.from === oldLabel && upd?.to === newLabel);
const csvA = (await api(`/api/export?as=A&address=${W3}&namespace=${ns}`)).text;
const csvB = (await api(`/api/export?as=B&address=${W3}&namespace=${ns}`)).text;
const row = csvA.split("\n").find((l) => l.includes(`rule: ${target.key.slice(0, 20)}`));
check("next import/export uses the new label (exchange, by direction)", !!row && /^exchange_(deposit|withdrawal)$/.test(row.split(",")[2]));
log(`  CSV row: ${row?.slice(0, 120)}`);
check("app B CSV equals app A CSV after the correction", csvA === csvB);

log("== memory inventory (listMemories)");
const rules = (await api(`/api/rules?as=A&namespace=${ns}`)).j;
log(`  listMemories count: ${rules.listed}; rules recalled ${rules.rules.length}, outcomes ${rules.outcomes.length}, recalled total ${rules.recalled}, incomplete=${rules.incomplete}`);
check("listMemories count >= 10", rules.listed >= 10);
check("recall found everything listMemories counts", !rules.incomplete);

log("== wallet1 imported by typing its address");
const w1 = await imp({}, W1);
log(`  wallet1: ${w1.txCount} txs (${w1.source}${w1.cachedAt ? " cached at " + w1.cachedAt : ""}); labels ${JSON.stringify(w1.labelCounts)}; asked ON ${w1.counts.on.asked} / OFF ${w1.counts.off.asked}`);
check("wallet1 imports (500 txs)", w1.txCount === 500);

log("== live Tatum address + validation");
const live = await imp({}, LIVE);
log(`  live address: ${live.txCount} txs, source=${live.source}; asked ${live.counts.on.asked}`);
check("non-demo address read live from Tatum", live.source === "live" && live.txCount > 0);
const bad = await api("/api/import", { address: "0x123", namespace: ns });
check("invalid address -> clear 400", bad.status === 400 && /valid Sui address/.test(bad.j.error)); log("  " + bad.j.error);
const empty = await api("/api/import", { address: "0x" + "0".repeat(60) + "1234", namespace: ns });
check("empty wallet -> clear message", empty.status === 400 && /No transactions/.test(empty.j.error)); log("  " + empty.j.error);

const failed = checks.filter(([, ok]) => !ok);
console.log(`\nRESULT ${checks.length - failed.length}/${checks.length} checks passed; namespace ${ns}; listMemories=${rules.listed}`);
console.log(failed.length ? "FAIL: " + failed.map(([n]) => n).join("; ") : "PASS");
process.exit(failed.length ? 1 : 0);
