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

import { countQuestions, resolveRules, latestOutcome } from "../lib/learning.ts";
import { outcomeToText, outcomeFromText } from "../lib/memory.ts";

test("repeat vs new counting on wallet3 import 2 (rules from import 1)", () => {
  const f = load("wallet3");
  const part = (from: string, to: string) => f.txs.filter((t: any) => t.timestamp >= from && t.timestamp < to);
  const imp1 = part("0000", "2026-07-01"), imp2 = part("2026-07-01", "2027");
  const q1 = questionsFrom(imp1.map((t: any) => classify(t, f.wallet)));
  const rules: Rule[] = q1.map((q) => ({ match: q.key, label: "ignore" }));   // answer everything in import 1
  const keys = new Set(rules.map((r) => r.match.toLowerCase()));
  const off = questionsFrom(imp2.map((t: any) => classify(t, f.wallet)));
  const on = questionsFrom(imp2.map((t: any) => classify(t, f.wallet, rules)));
  const cOff = countQuestions(off, keys), cOn = countQuestions(on, keys);
  assert.equal(cOff.repeat, 2);              // two counterparties answered in import 1 come back
  assert.equal(cOff.new, 3);                 // three never seen before
  assert.equal(cOn.repeat, 0);               // with memory no repeat is asked again
  assert.equal(cOn.asked, cOn.new);
  assert.equal(cOn.asked, 3);
});

test("newest created_at wins and the change is reported", () => {
  const r = resolveRules([
    { rule: { match: "0xA", label: "payment_sent" }, blob: "b1", at: "2026-11-05T10:00:00Z" },
    { rule: { match: "0xa", label: "exchange_deposit" }, blob: "b2", at: "2026-11-05T10:05:00Z" },
    { rule: { match: "0xb", label: "ignore" }, blob: "b3", at: "2026-11-05T10:01:00Z" },
  ]);
  assert.deepEqual(r.rules.find((x) => x.match === "0xa"), { match: "0xa", label: "exchange_deposit" });
  assert.equal(r.blobs["0xa"], "b2");
  assert.deepEqual(r.updates, [{ match: "0xa", from: "payment_sent", to: "exchange_deposit" }]);
  assert.equal(r.rules.length, 2);
});

test("correcting back to an older label still wins (newest memory)", () => {
  const r = resolveRules([
    { rule: { match: "0xa", label: "swap" }, blob: "b1", at: "1" },
    { rule: { match: "0xa", label: "ignore" }, blob: "b2", at: "2" },
    { rule: { match: "0xa", label: "swap" }, blob: "b3", at: "3" },
  ]);
  assert.equal(r.rules[0].label, "swap");
  assert.equal(r.blobs["0xa"], "b3");
});

test("a corrected rule changes the label on the next classification", () => {
  const f = load("wallet1");
  const cp = "0x3d2b30914438e4684057aa8cb99350d779772e7f12050e5e4f4ed5be17d20474";
  const rules = resolveRules([
    { rule: { match: cp, label: "exchange_deposit" }, blob: "b1", at: "1" },
    { rule: { match: cp, label: "own_wallet_transfer" }, blob: "b2", at: "2" },
  ]).rules;
  const hit = f.txs.map((t: any) => classify(t, f.wallet, rules)).find((r: any) => r.detail === `rule: ${cp}`);
  assert.equal(hit.label, "own_wallet_transfer");
});

test("outcome text round-trips and the latest outcome for a wallet is picked", () => {
  const o = { wallet: "0xw", range: "start..2026-06-30", txs: 36, asked: 5, answered: 5, reused: 0 };
  assert.deepEqual(outcomeFromText(outcomeToText(o)), o);
  assert.match(outcomeToText(o), /v=1$/);
  const last = latestOutcome([{ ...o, blob: "x", at: "1" }, { ...o, asked: 3, blob: "y", at: "2" }, { ...o, wallet: "0xz", blob: "z", at: "3" }], "0xW");
  assert.equal(last?.blob, "y");
});
