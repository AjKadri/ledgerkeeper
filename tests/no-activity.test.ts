import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyInfo, emptyMessage } from "../lib/history.ts";
import { fail } from "../lib/http.ts";
import { UserError, NO_RECENT_ACTIVITY } from "../lib/errors.ts";

const withBalance = async <T>(total: string, fn: () => Promise<T>) => {
  process.env.GQL_RETRY_BASE_MS = "5"; process.env.TATUM_API_KEY = "x";
  const real = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ data: { address: { balance: { totalBalance: total } } } }), { status: 200 })) as typeof fetch;
  try { return await fn(); } finally { globalThis.fetch = real; }
};
const A = "0x" + "ab".repeat(32);

test("funds but no activity since the history start: reason no_recent_activity, message unchanged", async () => {
  const e = await withBalance("5000000000", () => emptyInfo(A));
  assert.equal(e.reason, NO_RECENT_ACTIVITY);
  assert.match(e.message, /^No transactions since 2026-01-23\. This address holds funds/);
  assert.equal(await withBalance("5000000000", () => emptyMessage(A)), e.message);
});

test("empty wallet: no reason field", async () => {
  const e = await withBalance("0", () => emptyInfo(A));
  assert.equal(e.reason, undefined);
  assert.match(e.message, /^No transactions found for this address/);
});

test("the API adds reason only when there is one (additive)", async () => {
  const withR = await fail(new UserError("m", NO_RECENT_ACTIVITY)).json();
  assert.deepEqual(withR, { error: "m", reason: NO_RECENT_ACTIVITY });
  const without = await fail(new UserError("m")).json();
  assert.deepEqual(without, { error: "m" });
});
