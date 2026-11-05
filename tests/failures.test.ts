import { test } from "node:test";
import assert from "node:assert/strict";
import { gql } from "../lib/gql.ts";
import { recallRules } from "../lib/rules.ts";
import { ruleToText } from "../lib/memory.ts";

test("Tatum 429 is retried, then succeeds", async () => {
  process.env.GQL_RETRY_BASE_MS = "5"; process.env.TATUM_API_KEY = "x";
  const real = globalThis.fetch; let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return calls < 3
      ? new Response("rate limited", { status: 429 })
      : new Response(JSON.stringify({ data: { ok: true } }), { status: 200 });
  }) as typeof fetch;
  try { assert.deepEqual(await gql("{ok}"), { ok: true }); assert.equal(calls, 3); } finally { globalThis.fetch = real; }
});

test("Tatum outage: gives up with a clear error after the retries", async () => {
  process.env.GQL_RETRY_BASE_MS = "5";
  const real = globalThis.fetch; let calls = 0;
  globalThis.fetch = (async () => { calls++; return new Response("down", { status: 503 }); }) as typeof fetch;
  try { await assert.rejects(() => gql("{ok}", {}, 3), /HTTP 503/); assert.equal(calls, 3); } finally { globalThis.fetch = real; }
});

// A fake Walrus Memory that lists 3 memories but only ever recalls 2 of them.
const fakeMem = (recalls: { blob: number }[][]) => {
  let n = 0;
  const texts = ["[tax-rule] match=0xa kind=exchange v=2", "[tax-rule] match=0xb label=swap v=2", ruleToText({ match: "0xc", kind: "own" })];
  return {
    calls: () => n,
    listMemories: async () => ({ memories: texts.map((_, i) => ({ blob_id: "b" + i, created_at: "2026-11-05T10:0" + i })), next_cursor: null, has_more: false }),
    recall: async () => { const r = recalls[Math.min(n++, recalls.length - 1)]; return { results: r.map((x) => ({ blob_id: "b" + x.blob, text: texts[x.blob], distance: 0.1 })), total: r.length }; },
  } as any;
};

test("recall returns fewer than listMemories counts: retried, then flagged incomplete (never silent)", async () => {
  const mem = fakeMem([[{ blob: 0 }, { blob: 1 }]]);
  const rs = await recallRules("A", "lk-0123456789abcdef", { mem, retryDelayMs: 1 });
  assert.equal(rs.listed, 3);
  assert.equal(rs.recalled, 2);
  assert.equal(rs.incomplete, true);
  assert.ok(mem.calls() >= 3 * 2, "retried 3 times (2 queries each)");
});

test("recall that catches up on retry is complete", async () => {
  const mem = fakeMem([[{ blob: 0 }], [{ blob: 0 }, { blob: 1 }, { blob: 2 }]]);
  const rs = await recallRules("A", "lk-0123456789abcdef", { mem, retryDelayMs: 1 });
  assert.equal(rs.incomplete, false);
  assert.equal(rs.rules.length, 3);
});
