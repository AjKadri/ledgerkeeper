// The sample CSV linked from the product page ("Sample CSV, from the demo memory as of 9 Nov"). Built at build time from
// the recorded sample wallet with the same export code the accountant view uses, and a dated snapshot of the 5 rules in
// the demo memory (data/sample-rules-2026-11-09.json). No memory is read at build or run time.
import snapshot from "../data/sample-rules-2026-11-09.json";
import { getHistory } from "./history";
import { toCsv, toRows } from "./export";
import { DEMO_WALLET } from "./config";
import type { Rule } from "./classify";

// The text of a real rule, as stored in Walrus Memory by the sample run (shown on the product page's rule card).
export const SAMPLE_RULE_TEXT = "[tax-rule] match=0x60956e40d8f921affde3cb861de91a6a6a0bab28af7cd1c23e029d46b86a449b kind=exchange v=2";

export const SAMPLE_SNAPSHOT_DATE = snapshot.takenAt;
export const sampleRules = (): Rule[] =>
  snapshot.rules.map((r: { match: string; kind?: string; label?: string }) => (r.kind ? { match: r.match, kind: r.kind as Rule["kind"] } : { match: r.match, label: r.label }));

export async function sampleCsv(): Promise<string> {
  const h = await getHistory(DEMO_WALLET, { forceCache: true });
  return toCsv(toRows(h.txs, DEMO_WALLET, sampleRules()));
}
