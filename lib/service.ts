// Request-level logic shared by the routes.
import { ADDRESS_RE, NAMESPACE_RE } from "./config";
import { UserError } from "./errors";
import { classify, questionsFrom, type Rule } from "./classify";
import { getHistory, inRange, emptyMessage } from "./history";
import { countQuestions, latestOutcome } from "./learning";
import { recallRules, writesAllowed, type App, type RuleSet } from "./rules";
import { toRows, toCsv } from "./export";

export { UserError };

export function checkAddress(a: unknown): string {
  if (typeof a !== "string" || !ADDRESS_RE.test(a.trim())) throw new UserError("That is not a valid Sui address (expected 0x followed by 64 hex characters).");
  return a.trim().toLowerCase();
}
export function checkNamespace(n: unknown): string {
  if (typeof n !== "string" || !NAMESPACE_RE.test(n)) throw new UserError("Invalid session id.");
  return n;
}
const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export async function runImport(body: any) {
  const address = checkAddress(body.address);
  const namespace = checkNamespace(body.namespace);
  const from = date(body.from), to = date(body.to);
  const memory = body.memory !== false;

  const hist = await getHistory(address);
  const txs = inRange(hist.txs, from, to);
  if (!txs.length) throw new UserError(hist.txs.length ? "No transactions in that date range." : await emptyMessage(address));

  // Always recall, so both columns (memory ON / OFF) can be shown for the same import.
  const rs = await recallRules("A", namespace);
  const ruleKeys = new Set(rs.rules.map((r) => r.match.toLowerCase()));
  const withoutQs = questionsFrom(txs.map((t) => classify(t, address)));
  const resultsOn = txs.map((t) => classify(t, address, rs.rules));
  const onQs = questionsFrom(resultsOn);
  const results = memory ? resultsOn : txs.map((t) => classify(t, address));

  const labelCounts: Record<string, number> = {};
  for (const r of results) labelCounts[r.label] = (labelCounts[r.label] ?? 0) + 1;
  const shown = memory ? onQs : withoutQs;
  const questions = shown.map((q) => ({
    ...q,
    repeat: ruleKeys.has(q.key.toLowerCase()),
    samples: results.filter((r) => r.questionKey === q.key).slice(0, 3).map((r) => ({ digest: r.digest, date: r.date, detail: r.detail })),
  }));
  const on = countQuestions(onQs, ruleKeys), off = countQuestions(withoutQs, ruleKeys);
  const last = latestOutcome(rs.outcomes, address);
  return {
    address, namespace, from, to, txCount: txs.length, source: hist.source, cachedAt: hist.cachedAt, note: hist.note,
    memory, labelCounts, questions, counts: { on, off },
    // "reused" = repeat questions memory answered for us in this import
    reused: off.repeat,
    previousOutcome: last ? { range: last.range, txs: last.txs, asked: last.asked, answered: last.answered, reused: last.reused, blob: last.blob } : null,
    updates: rs.updates,
    writes: writesAllowed(),
    memoryStats: { rules: rs.rules.length, outcomes: rs.outcomes.length, listed: rs.listed, recalled: rs.recalled, incomplete: rs.incomplete },
  };
}

export async function runExport(app: App, body: { address: unknown; namespace: unknown }) {
  const address = checkAddress(body.address);
  const namespace = checkNamespace(body.namespace);
  const hist = await getHistory(address);
  const rs = await recallRules(app, namespace);
  const rows = toRows(hist.txs, address, rs.rules);
  return {
    csv: toCsv(rows), rows: rows.length, source: hist.source, cachedAt: hist.cachedAt,
    rules: { count: rs.rules.length, outcomes: rs.outcomes.length, listed: rs.listed, incomplete: rs.incomplete, conflicts: rs.conflicts, updates: rs.updates, blobs: rs.blobs },
    unknown: rows.filter((r) => r.label === "unknown").length,
  };
}
