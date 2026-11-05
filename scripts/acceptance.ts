// M2 acceptance: import 1 -> answer all -> saved -> import 2 (memory ON vs OFF) -> app B CSV == app A CSV.
//   BASE_URL=https://... npx tsx scripts/acceptance.ts
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const WALLET = process.env.WALLET ?? "0xfee42d20b4616a1c11b1361361404dac42442b5d9be275521dba05d84a7e1342";
const ns = "lk-" + randomBytes(8).toString("hex");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function post(path: string, body: unknown) {
  const r = await fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json(); if (!r.ok) throw new Error(`${path} ${r.status}: ${j.error}`); return j;
}
const get = async (path: string) => { const r = await fetch(BASE + path); if (!r.ok) throw new Error(`${path} ${r.status}: ${await r.text()}`); return r; };
const imp = (extra: object) => post("/api/import", { address: WALLET, namespace: ns, ...extra });

log("target", BASE, "namespace", ns);
const i1 = await imp({ to: "2026-06-30" });
log(`import 1: ${i1.txCount} txs (${i1.source}${i1.cachedAt ? " cached at " + i1.cachedAt : ""}), questions asked: ${i1.questions.length}`);

// Demo answers: transfers by direction, framework/contract questions ignored.
const t0 = Date.now();
const jobs: { key: string; label: string; jobId: string }[] = [];
for (const q of i1.questions) {
  const detail: string = q.samples[0]?.detail ?? "";
  const label = !q.key.startsWith("0x") || q.key.includes("::") ? "ignore" : detail.includes("transfer out") ? "payment_sent" : "payment_received";
  const a = await post("/api/answer", { namespace: ns, match: q.key, label });
  jobs.push({ key: q.key, label, jobId: a.jobId });
  log(`  answer accepted: ${q.key.slice(0, 14)}… -> ${label} (job ${a.jobId.slice(0, 8)})`);
}
const blobs: Record<string, string> = {};
for (const j of jobs) {
  for (let i = 0; i < 60; i++) {
    const s = await (await get(`/api/job?namespace=${ns}&id=${j.jobId}`)).json();
    if (s.status === "done") { blobs[j.key] = s.blob_id; log(`  saved ${j.key.slice(0, 14)}… blob ${s.blob_id}`); break; }
    if (s.status === "failed") throw new Error("job failed: " + s.error);
    await sleep(3000);
  }
  if (!blobs[j.key]) throw new Error("timed out waiting for save: " + j.key);
}
log(`all ${jobs.length} answers saved in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

await sleep(3000); // let the index catch up (spike measured ~2 s)
const on = await imp({ from: "2026-07-01", to: "2026-08-31", memory: true });
const off = await imp({ from: "2026-07-01", to: "2026-08-31", memory: false });
log(`import 2 (${on.txCount} txs): memory ON asked ${on.questions.length}; memory OFF asked ${off.questions.length}; rules recalled ${on.rulesRecalled.count}/${on.rulesRecalled.listed} incomplete=${on.rulesRecalled.incomplete}`);

const csvA = await (await get(`/api/export?as=A&address=${WALLET}&namespace=${ns}`)).text();
const csvB = await (await get(`/api/export?as=B&address=${WALLET}&namespace=${ns}`)).text();
writeFileSync("/tmp/lk-A.csv", csvA); writeFileSync("/tmp/lk-B.csv", csvB);
const same = csvA === csvB;
log(`CSV A: ${csvA.trim().split("\n").length - 1} rows, B: ${csvB.trim().split("\n").length - 1} rows, identical: ${same}`);

const fewer = on.questions.length < off.questions.length;
console.log("\nRESULT", JSON.stringify({ namespace: ns, import1Asked: i1.questions.length, import2MemoryOn: on.questions.length, import2MemoryOff: off.questions.length, fewer, csvIdentical: same, savedBlobs: Object.keys(blobs).length }));
console.log(fewer && same ? "PASS" : "FAIL");
process.exit(fewer && same ? 0 : 1);
