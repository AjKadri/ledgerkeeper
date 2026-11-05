import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classify, questionsFrom, type Rule } from "../lib/classify.ts";
import { ruleToText, ruleFromText } from "../lib/memory.ts";
import { APP_NAME } from "../lib/config.ts";

const load = (n: string) => JSON.parse(readFileSync(new URL(`../fixtures/${n}.json`, import.meta.url), "utf8"));
const run = (n: string, rules: Rule[] = []) => {
  const f = load(n);
  const results = f.txs.map((t: any) => classify(t, f.wallet, rules));
  const labels: Record<string, number> = {};
  for (const r of results) labels[r.label] = (labels[r.label] ?? 0) + 1;
  return { f, results, labels, questions: questionsFrom(results) };
};

test("product name constant", () => assert.equal(APP_NAME, "LedgerKeeper"));

for (const [n, q] of [["wallet1", 4], ["wallet2", 10], ["wallet3", 8]] as const) {
  test(`${n}: ${q} questions`, () => {
    const { f, questions } = run(n);
    assert.equal(f.expectedQuestions, q);
    assert.equal(questions.length, q);
  });
}

test("wallet1: only counterparty questions, no framework (0x1/0x2/0x3) questions", () => {
  const { questions } = run("wallet1");
  for (const q of questions) assert.ok(!q.key.includes("::"), q.key);
});

test("wallet1: label counts", () => {
  const { labels } = run("wallet1");
  assert.deepEqual(labels, { unknown: 349, stake: 75, unstake: 53, stake_convert: 23 });
});

test("wallet3: swap/LP label counts, lp_compound kept separate", () => {
  const { labels } = run("wallet3");
  assert.equal(labels.lp_compound, 12);
  assert.equal(labels.lp_add, 9);
  assert.equal(labels.lp_remove, 2);
  assert.equal(labels.swap, 6);
  assert.equal(labels.reward_claim, 3);
});

test("wallet1: the four spike answers remove every question", () => {
  const rules: Rule[] = [
    { match: "0xc83cc934aa230c9ca4d5eef0a63d7f1c088c0fb137eb239330f5f84bec15e476", label: "ignore" },
    { match: "0xc94cf14976d6afe1bd9b9a0e4687a6fe20bc77128acdf89871eaa71aae350966", label: "own_wallet_transfer" },
    { match: "0x3d2b30914438e4684057aa8cb99350d779772e7f12050e5e4f4ed5be17d20474", label: "exchange_deposit" },
    { match: "0x7c8e2ceb0839680a3b1f7aa1021d45670405d92f3c88e79aa1d3aa8a600bbdbf", label: "ignore" },
  ];
  assert.equal(run("wallet1", rules).questions.length, 0);
});

test("rule text round-trips", () => {
  const r = { match: "0xabc", label: "swap" };
  assert.match(ruleToText(r), /v=1$/);
  assert.deepEqual(ruleFromText(ruleToText(r)), r);
});
