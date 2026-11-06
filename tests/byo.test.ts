import test from "node:test";
import assert from "node:assert/strict";
import { parseRuleSet } from "../lib/wire.ts";
import { recallWith } from "../lib/recall.ts";
import { allowedRelayPath } from "../lib/relay.ts";
import { runImport } from "../lib/service.ts";
import { DEMO_WALLET } from "../lib/config.ts";
import { ruleToText } from "../lib/memory.ts";

const fakeMem = (texts: string[]) => ({
  recall: async () => ({ results: texts.map((text, i) => ({ text, blob_id: `b${i}`, created_at: `2026-11-0${i + 1}` })) }),
  listMemories: async () => ({ memories: texts.map((_, i) => ({ blob_id: `b${i}`, created_at: `2026-11-0${i + 1}`, namespace: "ns" })), has_more: false, next_cursor: null }),
}) as any;

test("a rule set recalled in the browser survives the wire check unchanged", async () => {
  const rs = await recallWith(fakeMem([ruleToText({ match: "0xaa", kind: "exchange" })]), "ns", { retryDelayMs: 1 });
  assert.deepEqual(parseRuleSet(JSON.parse(JSON.stringify(rs))).rules, [{ match: "0xaa", kind: "exchange" }]);
});

test("the server rejects a malformed or oversized rule set instead of trusting it", () => {
  assert.throws(() => parseRuleSet(null));
  assert.throws(() => parseRuleSet({ rules: [{ match: "0xaa", kind: "wizard" }], blobs: {}, ats: {}, events: [], conflicts: [], updates: [], outcomes: [], recalled: 0, listed: 0 }));
  assert.throws(() => parseRuleSet({ rules: Array.from({ length: 6000 }, () => ({ match: "0x1", label: "swap" })), blobs: {}, ats: {}, events: [], conflicts: [], updates: [], outcomes: [], recalled: 0, listed: 0 }));
});

test("an import in own-memory mode classifies with the rule set it was sent, not the demo memory", async () => {
  const base = { address: DEMO_WALLET, to: "2026-06-30" };
  const none = await runImport({ ...base, ruleSet: parseRuleSet({ rules: [], blobs: {}, ats: {}, events: [], conflicts: [], updates: [], outcomes: [], recalled: 0, listed: 0 }) });
  assert.ok(none.questions.length > 0);
  const key = none.questions.find((q: any) => !q.key.includes("::"))!.key;
  const rs = await recallWith(fakeMem([ruleToText({ match: key, kind: "person" })]), "ns", { retryDelayMs: 1 });
  const some = await runImport({ ...base, ruleSet: parseRuleSet(JSON.parse(JSON.stringify(rs))) });
  assert.equal(some.questions.length, none.questions.length - 1);
  assert.equal(some.answeredFromMemory.length, 1);
  assert.deepEqual(some.writes, { ok: true });
});

test("the relay pass-through forwards relayer paths only", () => {
  for (const p of ["health", "version", "config", "api/recall", "api/remember/abc-123", "v1/owners/0xabc/memories"]) assert.equal(allowedRelayPath(p), true, p);
  for (const p of ["", "admin", "api/../etc", "internal/x", "api/UPPER", "v1/../x"]) assert.equal(allowedRelayPath(p), false, p);
});
