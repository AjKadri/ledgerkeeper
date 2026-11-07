// Request-level logic shared by the routes.
import { ADDRESS_RE, NAMESPACE_RE } from "./config";
import { UserError } from "./errors";
import { classify, questionsFrom, type Rule } from "./classify";
import { getHistory, inRange, emptyMessage } from "./history";
import { countQuestions, latestOutcome, ruleValue } from "./learning";
import { recallRules, writesAllowed, type App, type RuleSet } from "./rules";
import { toRows, toCsv } from "./export";
import { USD_BASIS } from "./price";
import { parseRuleSet } from "./wire";
import { OUTAGE_NO_SAVE } from "./stale";

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
  // Own-memory mode sends its rule set; otherwise the demo memory is recalled with the server's key.
  const own = body.ruleSet !== undefined;
  const namespace = own ? "own" : checkNamespace(body.namespace);
  const from = date(body.from), to = date(body.to);
  const memory = body.memory !== false;

  const hist = await getHistory(address);
  const txs = inRange(hist.txs, from, to);
  if (!txs.length) throw new UserError(hist.txs.length ? "No transactions in that date range." : await emptyMessage(address));

  // Always recall, so both columns (memory ON / OFF) can be shown for the same import.
  const rs = own ? parseRuleSet(body.ruleSet) : await recallRules("A", namespace);
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
  // Questions memory already answers: shown briefly, then filed into the drawer by the page.
  const ruleByKey = new Map(rs.rules.map((r) => [r.match.toLowerCase(), r]));
  const answeredFromMemory = withoutQs.filter((q) => ruleByKey.has(q.key.toLowerCase())).map((q) => {
    const r = ruleByKey.get(q.key.toLowerCase())!;
    return { key: q.key, question: q.question, count: q.count, in: q.in, out: q.out, first: q.first, last: q.last, value: ruleValue(r), blob: rs.blobs[q.key.toLowerCase()] ?? "" };
  });
  const ledger = toRows(txs, address, memory ? rs.rules : []);
  const last = latestOutcome(rs.outcomes, address);
  // The latest outcome stored for this same wallet and range: a re-import is compared against it, not against another range.
  const rangeKey = `${from ?? "start"}..${to ?? "now"}`;
  const same = latestOutcome(rs.outcomes.filter((o) => o.range === rangeKey), address);
  // Approximate USD value of the SUI legs in this import (other coins are not valued).
  const rows = toRows(txs, address, rs.rules).filter((r) => r.usd_value !== "");
  const usdNum = (r: { usd_value: string }) => Number(r.usd_value);
  const usd = {
    basis: USD_BASIS, priced: rows.length, of: txs.length,
    received: +rows.filter((r) => usdNum(r) > 0).reduce((s, r) => s + usdNum(r), 0).toFixed(2),
    sent: +rows.filter((r) => usdNum(r) < 0).reduce((s, r) => s + usdNum(r), 0).toFixed(2),
    top: [...rows].sort((a, b) => Math.abs(usdNum(b)) - Math.abs(usdNum(a))).slice(0, 5)
      .map((r) => ({ date: r.date.slice(0, 10), digest: r.digest, label: r.label, price: r.sui_usd_price, usd: r.usd_value })),
  };
  return {
    address, namespace, from, to, txCount: txs.length, source: hist.source, cachedAt: hist.cachedAt, note: hist.note,
    memory, labelCounts, questions, counts: { on, off },
    // "reused" = repeat questions memory answered for us in this import
    reused: off.repeat,
    sameRangeOutcome: same ? { range: same.range, txs: same.txs, asked: same.asked, answered: same.answered, reused: same.reused } : null,
    previousOutcome: last ? { range: last.range, txs: last.txs, asked: last.asked, answered: last.answered, reused: last.reused, blob: last.blob } : null,
    updates: rs.updates,
    usd, answeredFromMemory, rows: ledger,
    drawer: {
      rules: rs.rules, blobs: rs.blobs, ats: rs.ats, events: rs.events, listed: rs.listed, incomplete: rs.incomplete, stale: rs.stale ?? null,
      outcomes: rs.outcomes.map((o) => ({ range: o.range, txs: o.txs, asked: o.asked, answered: o.answered, reused: o.reused, at: o.at, blob: o.blob })),
    },
    stale: rs.stale ?? null,
    writes: rs.stale ? { ok: false, reason: `Memory unavailable. ${OUTAGE_NO_SAVE}` } : own ? { ok: true } : writesAllowed(),
    memoryStats: { rules: rs.rules.length, outcomes: rs.outcomes.length, listed: rs.listed, recalled: rs.recalled, incomplete: rs.incomplete },
  };
}

export async function runExport(app: App, body: { address: unknown; namespace: unknown; ruleSet?: unknown }) {
  const address = checkAddress(body.address);
  const own = body.ruleSet !== undefined;
  const hist = await getHistory(address);
  const rs = own ? parseRuleSet(body.ruleSet) : await recallRules(app, checkNamespace(body.namespace));
  const rows = toRows(hist.txs, address, rs.rules);
  return {
    csv: toCsv(rows), rows: rows.length, source: hist.source, cachedAt: hist.cachedAt,
    rules: { stale: rs.stale ?? null, count: rs.rules.length, outcomes: rs.outcomes.length, listed: rs.listed, incomplete: rs.incomplete, conflicts: rs.conflicts, updates: rs.updates, blobs: rs.blobs },
    unknown: rows.filter((r) => r.label === "unknown").length,
    ledger: rows,
    rulesList: rs.rules.map((r) => ({ match: r.match, value: ruleValue(r), blob: rs.blobs[r.match] ?? "", at: rs.ats[r.match] ?? "" })),
    outcomes: rs.outcomes.map((o) => ({ range: o.range, txs: o.txs, asked: o.asked, answered: o.answered, reused: o.reused, at: o.at, blob: o.blob })),
  };
}
