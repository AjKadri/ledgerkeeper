// Request-level logic shared by the routes.
import { ADDRESS_RE, NAMESPACE_RE } from "./config";
import { classify, questionsFrom, type Rule } from "./classify";
import { getHistory, inRange, EMPTY_MESSAGE } from "./history";
import { recallRules, type App, type RuleSet } from "./rules";
import { toRows, toCsv } from "./export";

export class UserError extends Error {}

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
  if (!txs.length) throw new UserError(hist.txs.length ? "No transactions in that date range." : EMPTY_MESSAGE);

  const without = txs.map((t) => classify(t, address));
  let rs: RuleSet | null = null;
  if (memory) rs = await recallRules("A", namespace);
  const results = txs.map((t) => classify(t, address, rs?.rules ?? []));

  const labelCounts: Record<string, number> = {};
  for (const r of results) labelCounts[r.label] = (labelCounts[r.label] ?? 0) + 1;
  const questions = questionsFrom(results).map((q) => ({
    ...q,
    samples: results.filter((r) => r.questionKey === q.key).slice(0, 3).map((r) => ({ digest: r.digest, date: r.date, detail: r.detail })),
  }));
  return {
    address, namespace, from, to, txCount: txs.length, source: hist.source, cachedAt: hist.cachedAt, note: hist.note,
    memory, labelCounts, questions,
    questionsWithoutMemory: questionsFrom(without).length,
    rulesRecalled: rs ? { count: rs.rules.length, listed: rs.listed, incomplete: rs.incomplete, conflicts: rs.conflicts } : null,
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
    rules: { count: rs.rules.length, listed: rs.listed, incomplete: rs.incomplete, conflicts: rs.conflicts, blobs: rs.blobs },
    unknown: rows.filter((r) => r.label === "unknown").length,
  };
}
