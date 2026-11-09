// Static snapshot for the product page's interactive demo. Built on the server from the recorded sample wallet
// (fixtures/wallet3.json) with the same classifier and export code the app uses. It never reads or writes memory:
// the demo shows what each answer *would* do, and nothing is saved.
import w3 from "../fixtures/wallet3.json";
import { classify, questionsFrom } from "./classify";
import { toRows } from "./export";
import { optionsFor, ruleFromValue } from "./answers";
import { ruleToText } from "./memory";
import { DEMO_WALLET, IMPORT_SPLIT } from "./config";
import type { Question, Row } from "@/components/types";

type Tx = Parameters<typeof classify>[0];

export type DemoSample = {
  question: Question;
  // rows for the right-hand frame, before any answer ("") and for each answer option
  rows: Record<string, Row[]>;
  // the rule text each answer would be stored as
  ruleText: Record<string, string>;
};

// The counterparty used on the product page (the same match as the stored rule shown there).
export const DEMO_MATCH = "0x60956e40d8f921affde3cb861de91a6a6a0bab28af7cd1c23e029d46b86a449b";

export function demoSample(): DemoSample {
  const txs = ((w3 as unknown as { txs: Tx[] }).txs).filter((t) => (t.timestamp ?? "").slice(0, 10) <= IMPORT_SPLIT.import1.to);
  const results = txs.map((t) => classify(t, DEMO_WALLET));
  const q = questionsFrom(results).find((x) => x.key.toLowerCase() === DEMO_MATCH);
  if (!q) throw new Error("demo sample: question not found in the fixture");
  const question: Question = {
    ...q, repeat: false,
    samples: results.filter((r) => r.questionKey === q.key).slice(0, 3).map((r) => ({ digest: r.digest, date: r.date })),
  };
  // The transactions this question is about, plus a few auto-labelled neighbours from the same import for context.
  const mine = new Set(results.filter((r) => r.questionKey === q.key).map((r) => r.digest));
  const others = results.filter((r) => !r.questionKey).slice(-6).map((r) => r.digest);
  const keep = new Set([...mine, ...others]);
  const subset = txs.filter((t) => keep.has(t.digest));
  // The question's own rows first, so the effect of an answer is visible without scrolling.
  const first = (rs: Row[]) => [...rs.filter((r) => mine.has(r.digest)), ...rs.filter((r) => !mine.has(r.digest))];
  const rows: Record<string, Row[]> = { "": first(toRows(subset, DEMO_WALLET, []) as Row[]) };
  const ruleText: Record<string, string> = {};
  for (const o of optionsFor(q.key)) {
    const rule = ruleFromValue(q.key, o.value);
    if (!rule) continue;
    rows[o.value] = first(toRows(subset, DEMO_WALLET, [rule]) as Row[]);
    ruleText[o.value] = ruleToText(rule);
  }
  return { question, rows, ruleText };
}
