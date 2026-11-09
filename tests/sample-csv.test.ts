import { test } from "node:test";
import assert from "node:assert/strict";
import { sampleCsv, SAMPLE_RULE_TEXT } from "../lib/sample-csv.ts";
import { runExport } from "../lib/service.ts";
import { ruleFromText } from "../lib/memory.ts";
import { DEMO_WALLET } from "../lib/config.ts";

test("the product page's Sample CSV equals what the accountant export produces for the sample", async () => {
  const rule = ruleFromText(SAMPLE_RULE_TEXT)!;
  const ruleSet = { rules: [rule], blobs: {}, ats: {}, events: [], conflicts: [], updates: [], outcomes: [], recalled: 1, listed: 1, incomplete: false };
  const viaExport = await runExport("B", { address: DEMO_WALLET, namespace: undefined, ruleSet });
  const csv = await sampleCsv();
  assert.equal(csv, viaExport.csv);
  assert.equal(csv.trim().split("\n").length, 48); // header + 47 transactions
  assert.match(csv, /exchange_withdrawal/);
});
