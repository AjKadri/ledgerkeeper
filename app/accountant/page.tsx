"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { friendly } from "@/lib/answers";
import { ago, dates, short } from "@/lib/format";
import { Header, Section, Trust } from "@/components/Chrome";
import { Ledger, Skeleton } from "@/components/Ledger";
import { Copyable } from "@/components/ui";
import { outageText } from "@/lib/stale";
import { rangeText } from "@/components/Drawer";
import type { Row } from "@/components/types";

type Out = {
  rows: number; unknown: number; source: string; cachedAt?: string; ledger: Row[];
  rules: { stale: { at: string } | null; count: number; outcomes: number; listed: number; incomplete: boolean; updates: { match: string; from: string; to: string }[] };
  rulesList: { match: string; value: string; blob: string; at: string }[];
  outcomes: { range: string; txs: number; asked: number; answered: number; reused: number; at: string; blob: string }[];
};

function View() {
  const p = useSearchParams();
  const address = p.get("address") ?? "", ns = p.get("ns") ?? "";
  const [out, setOut] = useState<Out | null>(null);
  const [err, setErr] = useState("");

  const [acct, setAcct] = useState("");
  useEffect(() => { fetch("/api/status").then((r) => r.json()).then((j) => setAcct(j.accountId ?? "")).catch(() => {}); }, []);
  useEffect(() => {
    if (!address || !ns) return;
    fetch(`/api/export?as=B&format=json&address=${address}&namespace=${ns}`).then(async (r) => {
      const j = await r.json(); if (!r.ok) throw new Error(j.error); setOut(j);
    }).catch((e) => setErr(e.message));
  }, [address, ns]);

  const dateRange = out && out.ledger.length ? dates(out.ledger[0].date.slice(0, 10), out.ledger[out.ledger.length - 1].date.slice(0, 10)) : "";

  return (
    <div className="app-b">
      <Header wallet={address || undefined} accountant />
      <div className="shell" style={{ paddingTop: 32, paddingBottom: 48 }}>
        {!address || !ns ? (
          <Section>
            <h1 className="rtitle">Nothing to show yet</h1>
            <p className="muted" style={{ marginTop: 8, maxWidth: "60ch" }}>This report opens from the owner&rsquo;s LedgerKeeper, with a wallet and a memory session. Ask them to use &ldquo;Open the accountant view&rdquo;.</p>
            <p style={{ marginTop: 16 }}><a className="btn" href="/">Go to LedgerKeeper</a></p>
          </Section>
        ) : (
          <>
            <Section>
              <h1 className="rtitle">Labelled transaction report</h1>
              <p className="muted" style={{ marginTop: 4 }}>
                Wallet <Copyable value={address} shown={short(address)} label="Copy wallet" />{dateRange && <> · <span className="num">{dateRange}</span></>}. Read-only: this app asks nothing and reads the owner&rsquo;s saved rules with its own key.
              </p>
              <p className="small muted" style={{ marginTop: 8 }}>
                Reads the <b>demo memory</b>{acct && <> (account <Copyable value={acct} shown={short(acct)} label="Copy account id" />)</>} only, for now. A memory made with &ldquo;Use my own memory (beta)&rdquo; is read in the main app with the key stored in that browser. This view cannot be given a second key yet, so for your own memory hand your accountant the CSV from the main app.
              </p>
              {err && <div className="banner banner--bad" role="alert" style={{ marginTop: 16 }}><b>Could not read this report.</b> {err}</div>}
              {!out && !err && <div className="rgrid" aria-busy="true">{[0, 1, 2].map((i) => <div key={i}><div className="sk" style={{ width: 80, height: 28 }} /><div className="sk" style={{ width: 120, marginTop: 8 }} /></div>)}</div>}
              {out && (
                <>
                  <div className="rgrid">
                    <div><div className="v num">{out.rows}</div><div className="k">transactions</div></div>
                    <div><div className="v num">{out.unknown}</div><div className="k">still unknown</div></div>
                    <div><div className="v num">{out.rules.count}</div><div className="k">rules from the owner&rsquo;s memory (plus {out.rules.outcomes} import outcome{out.rules.outcomes === 1 ? "" : "s"})</div></div>
                  </div>
                  <p className="small muted" style={{ marginTop: 16 }}>
                    Data: {out.source === "cached" ? `cached at ${out.cachedAt}` : "live from Tatum"}. Memory holds <span className="num">{out.rules.listed}</span> memories in total. USD value covers SUI legs only and is approximate (on-chain pool price, Cetus SUI/USDC); other coins are left blank.
                  </p>
                  {out.rules.stale && <div className="banner banner--warn" role="status" style={{ marginTop: 16 }}><b>{outageText(out.rules.stale)}</b> The labels and the CSV below use those rules. This report is read-only, so nothing is being saved from here.</div>}
                  {out.rules.incomplete && <div className="banner banner--bad" role="alert" style={{ marginTop: 16 }}><b>Memory returned fewer items than it holds.</b> Reload before trusting this export.</div>}
                  {out.rules.updates.map((u) => <p key={u.match} className="small" style={{ marginTop: 8, color: "var(--green)" }}>Rule <span className="mono">{short(u.match)}</span> was updated from {friendly(u.from, u.match)} to {friendly(u.to, u.match)}.</p>)}
                  <p className="no-print" style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <a className="btn btn--primary" href={`/api/export?as=B&address=${address}&namespace=${ns}`}>Download CSV</a>
                    <button type="button" className="btn" onClick={() => window.print()}>Print report</button>
                  </p>
                </>
              )}
            </Section>

            <Section title="Transactions" note={out ? `${out.ledger.length} rows` : undefined}>
              {out ? <Ledger rows={out.ledger} exportHref={`/api/export?as=B&address=${address}&namespace=${ns}`} app="B" hideExport /> : <Skeleton />}
            </Section>

            {out && (
              <Section title={`Rules from the owner's memory: ${out.rules.count}`} note="These decided the labels marked from memory.">
                <div className="rules-panel" style={{ marginTop: 0 }}>
                  <ul>
                    {out.rulesList.map((r) => (
                      <li key={r.match}>
                        <span className="what">{friendly(r.value, r.match)}</span>
                        <Copyable value={r.match} shown={short(r.match)} />
                        <span className="muted">saved {ago(r.at)}</span>
                        {r.blob && <a href={`https://walruscan.com/mainnet/blob/${r.blob}`} target="_blank" rel="noreferrer">blob {r.blob.slice(0, 8)}…</a>}
                      </li>
                    ))}
                    {out.rulesList.length === 0 && <li className="muted">The owner has not saved any rules yet, so every transaction uses built-in labels only.</li>}
                  </ul>
                  {out.outcomes.length > 0 && (
                    <>
                      <h3 style={{ fontSize: "var(--t-14)", fontWeight: 650, margin: "24px 0 4px" }}>Imports recorded in memory</h3>
                      <ul>
                        {out.outcomes.map((o) => (
                          <li key={o.blob}><span className="what">{rangeText(o.range)}</span><span><b className="num">{o.asked}</b> asked, <b className="num">{o.answered}</b> answered, <b className="num">{o.reused}</b> reused</span><span className="muted">{ago(o.at)}</span></li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </Section>
            )}
          </>
        )}
      </div>
      <Trust />
    </div>
  );
}

export default function Page() { return <Suspense><View /></Suspense>; }
