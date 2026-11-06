"use client";
import { useMemo, useState } from "react";
import { amountLines, day, labelGroup, labelName, ruleMatch, shortAddr, usd } from "@/lib/format";
import { Copyable, IconCheck, IconDownload, IconSearch } from "./ui";
import type { Row } from "./types";

const PAGE = 100;

export function Label({ label }: { label: string }) {
  return <span className="lab"><span className="dot" data-g={labelGroup(label)} aria-hidden="true" /><span className="t">{labelName(label)}</span></span>;
}

export function Skeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="ledger-wrap" aria-busy="true" aria-label="Loading transactions">
      {Array.from({ length: rows }, (_, i) => (
        <div className="skrow" key={i}>
          <span className="sk" style={{ width: "70%" }} /><span className="sk" style={{ width: `${40 + ((i * 17) % 40)}%` }} />
          <span className="sk" /><span className="sk" /><span className="sk" />
        </div>
      ))}
    </div>
  );
}

export function Ledger({ rows, onJumpRule, exportHref, app, hideExport }: {
  rows: Row[]; onJumpRule?: (match: string) => void; exportHref: string; app: "A" | "B"; hideExport?: boolean;
}) {
  const [group, setGroup] = useState<string>("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const r of rows) c.set(r.label, (c.get(r.label) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => (group === "all" || r.label === group) && (!s || r.counterparty.toLowerCase().includes(s) || r.digest.toLowerCase().includes(s)));
  }, [rows, group, q]);

  return (
    <div>
      <div className="chips" role="group" aria-label="Filter by label">
        <button type="button" className="chipbtn" aria-pressed={group === "all"} onClick={() => { setGroup("all"); setLimit(PAGE); }}>All <span className="num">{rows.length}</span></button>
        {counts.map(([l, n]) => (
          <button type="button" key={l} className="chipbtn" aria-pressed={group === l} onClick={() => { setGroup(l); setLimit(PAGE); }}>
            <span className="dot" data-g={labelGroup(l)} aria-hidden="true" />{labelName(l)} <span className="num">{n}</span>
          </button>
        ))}
      </div>
      <div className="tools no-print">
        <label className="grow" style={{ position: "relative" }}>
          <span className="sr-only">Search by address or digest</span>
          <span style={{ position: "absolute", left: 10, top: 12, color: "var(--muted)" }}><IconSearch /></span>
          <input className="field field--text" style={{ paddingLeft: 32 }} type="search" placeholder="Search by address or digest" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} />
        </label>
        {!hideExport && <a className="btn btn--primary" href={exportHref}><IconDownload /> Export CSV</a>}
      </div>
      <div className="ledger-wrap" tabIndex={0} aria-label="Transactions">
        <table className="ledger">
          <thead>
            <tr>
              <th scope="col">Date</th><th scope="col">Label</th><th scope="col" className="r">Amount</th>
              <th scope="col">Counterparty</th><th scope="col">Rule</th>
              <th scope="col" className="r">
                <span className="tip">
                  <button type="button" aria-describedby="usd-tip">≈ USD</button>
                  <span id="usd-tip" role="tooltip">Approximate, on-chain pool price (Cetus SUI/USDC). SUI legs only; other coins are blank.</span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, limit).map((r) => {
              const m = ruleMatch(r.rule_used);
              return (
                <tr key={r.digest} data-unknown={r.label === "unknown"}>
                  <td data-c="date" className="num"><a href={r.suiscan} target="_blank" rel="noreferrer" title={r.digest}>{day(r.date)}</a></td>
                  <td data-c="label"><Label label={r.label} /></td>
                  <td data-c="amt" className="r num">
                    {amountLines(r.assets_in, "+").map((a, i) => <div key={"i" + i} title={a.full}>{a.text}</div>)}
                    {amountLines(r.assets_out, "\u2212").map((a, i) => <div key={"o" + i} title={a.full} className="muted">{a.text}</div>)}
                  </td>
                  <td data-c="cp">{r.counterparty ? <Copyable value={r.counterparty} shown={shortAddr(r.counterparty)} /> : null}</td>
                  <td data-c="rule">
                    {m ? (
                      <span className="tag"><IconCheck />{app === "A" && onJumpRule ? <button type="button" onClick={() => onJumpRule(m)}>from memory</button> : "from memory"}</span>
                    ) : <span className="muted">built-in</span>}
                  </td>
                  <td data-c="usd" className="r num">{r.usd_value ? usd(Number(r.usd_value)) : ""}</td>
                </tr>
              );
            })}
            {shown.length === 0 && <tr><td colSpan={6} className="muted">No transactions match this filter. Clear the search or choose All.</td></tr>}
          </tbody>
        </table>
      </div>
      {shown.length > limit && <button type="button" className="btn more no-print" onClick={() => setLimit(limit + PAGE)}>Show {Math.min(PAGE, shown.length - limit)} more of {shown.length - limit}</button>}
    </div>
  );
}
