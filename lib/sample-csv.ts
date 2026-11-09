// The sample CSV linked from the product page ("Sample CSV"). Built at build time from the recorded sample wallet
// with the same export code the accountant view uses, and the one stored rule the page shows. No memory is read.
import { getHistory } from "./history";
import { toCsv, toRows } from "./export";
import { ruleFromText } from "./memory";
import { DEMO_WALLET } from "./config";

// The text of a real rule, as stored in Walrus Memory by the sample run (shown on the product page).
export const SAMPLE_RULE_TEXT = "[tax-rule] match=0x60956e40d8f921affde3cb861de91a6a6a0bab28af7cd1c23e029d46b86a449b kind=exchange v=2";

export async function sampleCsv(): Promise<string> {
  const rule = ruleFromText(SAMPLE_RULE_TEXT);
  if (!rule) throw new Error("sample rule does not parse");
  const h = await getHistory(DEMO_WALLET, { forceCache: true });
  return toCsv(toRows(h.txs, DEMO_WALLET, [rule]));
}
