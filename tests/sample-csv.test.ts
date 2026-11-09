import { test } from "node:test";
import assert from "node:assert/strict";
import { sampleCsv, sampleRules } from "../lib/sample-csv.ts";
import { runExport } from "../lib/service.ts";
import { DEMO_WALLET } from "../lib/config.ts";
import snapshot from "../data/sample-rules-2026-11-09.json" with { type: "json" };

test("the snapshot holds the demo memory's 5 rules, dated 9 Nov", () => {
  assert.equal(snapshot.takenAt, "2026-11-09");
  assert.equal(sampleRules().length, 5);
});

test("Sample CSV equals the accountant export (app B) for the snapshot's rule set", async () => {
  const ruleSet = { rules: sampleRules(), blobs: {}, ats: {}, events: [], conflicts: [], updates: [], outcomes: [], recalled: 5, listed: 5, incomplete: false };
  const viaExport = await runExport("B", { address: DEMO_WALLET, namespace: undefined, ruleSet });
  const csv = await sampleCsv();
  assert.equal(csv, viaExport.csv);
  assert.equal(csv.trim().split("\n").length, 48); // header + 47 transactions
  // every snapshot rule is used by at least one row
  for (const r of sampleRules()) assert.ok(csv.includes(r.match.slice(0, 20)) || csv.includes(r.match), r.match);
});
