import test from "node:test";
import assert from "node:assert/strict";
import { recallRules, saveRule, forgetCachedRules, isMemoryDown } from "../lib/rules.ts";
import { runImport } from "../lib/service.ts";
import { parseRuleSet } from "../lib/wire.ts";
import { ownRecall } from "../lib/byo.ts";
import { outageText, readAtText } from "../lib/stale.ts";
import { DEMO_WALLET } from "../lib/config.ts";
import { ruleToText } from "../lib/memory.ts";

const mem = (texts: string[]) => ({
  recall: async () => ({ results: texts.map((text, i) => ({ text, blob_id: `b${i}`, created_at: `2026-11-0${i + 1}T10:00:00Z` })) }),
  listMemories: async () => ({ memories: texts.map((_, i) => ({ blob_id: `b${i}`, created_at: `2026-11-0${i + 1}T10:00:00Z`, namespace: "ns" })), has_more: false, next_cursor: null }),
}) as any;
const down = { recall: async () => { throw new Error("502 relayer incident"); }, listMemories: async () => { throw new Error("502 relayer incident"); } } as any;
const rule = ruleToText({ match: "0xaa", kind: "exchange" });
const opts = { retryDelayMs: 1 };

test("when memory cannot be read, the last good read is served, with its time", async () => {
  forgetCachedRules();
  const first = await recallRules("A", "lk-0000000000000001", { ...opts, mem: mem([rule]) });
  assert.equal(first.stale, undefined);
  const again = await recallRules("A", "lk-0000000000000001", { ...opts, mem: down });
  assert.deepEqual(again.rules, first.rules);
  assert.ok(again.stale && !Number.isNaN(Date.parse(again.stale.at)));
});

test("with no earlier good read there is nothing to fall back on, so the error is reported", async () => {
  forgetCachedRules();
  await assert.rejects(recallRules("A", "lk-0000000000000002", { ...opts, mem: down }), /relayer incident/);
});

test("an incomplete read is not kept as the fallback", async () => {
  forgetCachedRules();
  const short = { ...mem([rule]), listMemories: async () => ({ memories: [{ blob_id: "b0", created_at: "x", namespace: "n" }, { blob_id: "b9", created_at: "x", namespace: "n" }], has_more: false, next_cursor: null }) };
  const r = await recallRules("A", "lk-0000000000000003", { ...opts, mem: short as any });
  assert.equal(r.incomplete, true);
  await assert.rejects(recallRules("A", "lk-0000000000000003", { ...opts, mem: down }));
});

test("saving is refused while memory is unavailable, and allowed again after a good read", async () => {
  forgetCachedRules();
  const ns = "lk-0000000000000004";
  await recallRules("A", ns, { ...opts, mem: mem([rule]) });
  await recallRules("A", ns, { ...opts, mem: down });
  assert.equal(isMemoryDown(ns), true);
  await assert.rejects(saveRule(ns, { match: "0xbb", kind: "person" }, "answer-0001"), /Memory unavailable/);
  await recallRules("A", ns, { ...opts, mem: mem([rule]) });
  assert.equal(isMemoryDown(ns), false);
});

test("an import with a stale rule set still applies the rules, reports the time and turns writes off", async () => {
  const rs = parseRuleSet({ rules: [], blobs: {}, ats: {}, events: [], conflicts: [], updates: [], outcomes: [], recalled: 0, listed: 0, stale: { at: "2026-11-07T10:00:00.000Z" } });
  const out = await runImport({ address: DEMO_WALLET, to: "2026-06-30", ruleSet: rs });
  assert.equal(out.stale?.at, "2026-11-07T10:00:00.000Z");
  assert.equal(out.writes.ok, false);
  assert.match(out.writes.reason ?? "", /Memory unavailable/);
  assert.ok(out.questions.length > 0);
});

test("own-memory mode keeps the last good read in the browser and serves it, marked stale, during an outage", async () => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
  const m = { accountId: "0xacc" } as any;
  const first = await ownRecall(m, mem([rule]));
  assert.equal(first.stale, undefined);
  const again = await ownRecall(m, down);
  assert.deepEqual(again.rules, first.rules);
  assert.ok(again.stale);
  store.clear();
  await assert.rejects(ownRecall(m, down));
});

test("the banner says what happened and when", () => {
  const today = new Date(); today.setHours(14, 32, 0, 0);
  assert.equal(outageText({ at: today.toISOString() }), "Memory unavailable, using your rules as last read at 14:32.");
  assert.match(readAtText("2026-01-05T09:05:00", new Date("2026-11-07T12:00:00")), /^5 Jan, 09:05$/);
});
