import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { demoSample, DEMO_MATCH } from "../lib/demo-sample.ts";

// The product-page demo must save nothing: its client code (and everything it imports) has no network call,
// no API route and no memory client.
const CLIENT_FILES = ["components/Demo.tsx", "components/QuestionCard.tsx", "components/Ledger.tsx", "components/ui.tsx", "components/types.ts", "lib/answers.ts", "lib/format.ts"];

test("demo client code makes no network calls and imports no memory code", () => {
  for (const f of CLIENT_FILES) {
    const src = readFileSync(f, "utf8");
    assert.doesNotMatch(src, /\bfetch\s*\(/, `${f} calls fetch`);
    assert.doesNotMatch(src, /["'`]\/api\//, `${f} references an API route`);
    assert.doesNotMatch(src, /from\s+["'][^"']*(lib\/(memory|rules|byo|recall|service)|memwal)["']/, `${f} imports memory code`);
  }
  // Demo.tsx imports only the files listed above (plus react)
  const imports = [...readFileSync("components/Demo.tsx", "utf8").matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
  assert.deepEqual(imports.sort(), ["./Ledger", "./QuestionCard", "./types", "./ui", "@/lib/answers", "react"].sort());
});

test("demo sample: the stored-rule counterparty, rows for every answer, rule text per answer", () => {
  const d = demoSample();
  assert.equal(d.question.key.toLowerCase(), DEMO_MATCH);
  assert.equal(d.question.count, 2);
  assert.deepEqual(Object.keys(d.rows).sort(), ["", "kind:exchange", "kind:own", "kind:person", "label:ignore"]);
  assert.equal(d.ruleText["kind:exchange"], `[tax-rule] match=${DEMO_MATCH} kind=exchange v=2`);
  // the question's rows come first and change label with the answer
  assert.deepEqual(d.rows["kind:exchange"].slice(0, 2).map((r) => r.label), ["exchange_withdrawal", "exchange_withdrawal"]);
  assert.deepEqual(d.rows[""].slice(0, 2).map((r) => r.label), ["unknown", "unknown"]);
});
