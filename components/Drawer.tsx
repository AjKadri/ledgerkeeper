"use client";
import { useEffect, useState } from "react";
import { friendly, optionsFor } from "@/lib/answers";
import { ago, day, short } from "@/lib/format";
import { Copyable, Steps } from "./ui";
import { Hint } from "./Guide";
import type { DrawerData, DrawerOutcome, SaveState } from "./types";

const blob = (b: string) => (
  <a href={`https://walruscan.com/mainnet/blob/${b}`} target="_blank" rel="noreferrer" title={b}>blob {b.slice(0, 8)}…</a>
);

// "start..2026-06-30" -> "up to 30 Jun"; "2026-07-01..2026-08-31" -> "1 Jul – 31 Aug"; "start..now" -> "all history"
export function rangeText(r: string): string {
  const [a, b] = r.split("..");
  if (a === "start" && b === "now") return "all history";
  if (a === "start") return `up to ${day(b)}`;
  if (b === "now") return `from ${day(a)}`;
  return `${day(a)} – ${day(b)}`;
}

type Item =
  | { k: "saved" | "update" | "outcome"; at: string; text: React.ReactNode };

export function Drawer({ data, saves, writesOn, writesReason, session, editing, setEditing, onChange, open, onClose, pulse, loading, onStartOver }: {
  data: DrawerData | null;
  saves: Record<string, SaveState>;
  writesOn: boolean;
  writesReason?: string;
  session: string;
  onStartOver: () => void;
  editing: string | null;
  setEditing: (m: string | null) => void;
  onChange: (match: string, value: string) => void;
  open: boolean;
  onClose: () => void;
  pulse: string[];
  loading: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [pick, setPick] = useState<Record<string, string>>({});
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

  const rules = data?.rules ?? [];
  const items: Item[] = [
    ...(data?.events ?? []).map((e): Item => ({
      k: e.kind === "updated" ? "update" : "saved", at: e.at,
      text: e.kind === "updated"
        ? <>Updated from {friendly(e.from ?? "", e.match)} to {friendly(e.value, e.match)} <span className="muted mono">{short(e.match)}</span></>
        : <>Saved {friendly(e.value, e.match).toLowerCase()} <span className="muted mono">{short(e.match)}</span></>,
    })),
    ...(data?.outcomes ?? []).map((o: DrawerOutcome): Item => ({
      k: "outcome", at: o.at,
      text: <>Import, {rangeText(o.range)}: <b className="num">{o.asked}</b> asked, <b className="num">{o.answered}</b> answered, <b className="num">{o.reused}</b> reused</>,
    })),
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  return (
    <>
      <div className="sheet-backdrop" data-open={open} onClick={onClose} />
      <aside className="side" data-open={open} aria-label="Memory drawer" id="memory-drawer">
        <div className="drawer">
          <button type="button" className="btn btn--quiet drawer__close" onClick={onClose}>Close memory drawer</button>
          <h2>Your memory</h2>
          <p className="drawer__sub">Walrus Memory, mainnet. Every answer is filed here as a rule.</p>
          <Hint id="drawer">Every answer you give is filed here, in your Walrus Memory.</Hint>
          <div className="drawer__stat">
            <div><div className="v num" data-dock-count>{loading && !data ? "–" : rules.length}</div><div className="k">{rules.length === 1 ? "rule" : "rules"}</div></div>
            <div><div className="v num">{data?.outcomes.length ?? (loading ? "–" : 0)}</div><div className="k">{data?.outcomes.length === 1 ? "import outcome" : "import outcomes"}</div></div>
          </div>
          {data?.incomplete && <p className="small" style={{ color: "var(--brick)", marginTop: 12 }} role="alert">Memory returned fewer items than it holds. Re-run the import before answering.</p>}

          <h3>Rules, newest first</h3>
          {rules.length === 0 && <p className="small muted">{loading ? "Reading your memory…" : "Nothing filed yet. Answer a question and it lands here."}</p>}
          <div className="rcards">
            {rules.map((r) => {
              const s = saves[r.match];
              const isEditing = editing === r.match;
              const chosen = pick[r.match] ?? r.value;
              return (
                <div key={r.match} className={`rcard${pulse.includes(r.match) ? " rcard--pulse" : ""}`} data-rule={r.match} tabIndex={-1} id={`rule-${r.match.slice(2, 14)}`}>
                  <div className="rcard__top">
                    <span className="rcard__kind">{friendly(r.value, r.match)}</span>
                    {!isEditing && <button type="button" className="btn btn--quiet" style={{ minHeight: 32, padding: "2px 8px" }} disabled={!writesOn} onClick={() => { setPick({ ...pick, [r.match]: r.value }); setEditing(r.match); }} aria-label={`Change the answer for ${short(r.match)}`}>Change</button>}
                  </div>
                  <div className="rcard__meta"><Copyable value={r.match} shown={short(r.match)} /> · saved {ago(r.at, now)}</div>
                  {r.blob && <div className="rcard__meta">{blob(r.blob)}</div>}
                  {isEditing && (
                    <div>
                      <div className="rcard__edit" role="radiogroup" aria-label={`New answer for ${short(r.match)}`}>
                        {optionsFor(r.match).map((o) => (
                          <button key={o.value} type="button" role="radio" aria-checked={chosen === o.value} className="choice" style={{ minHeight: 32, padding: "4px 10px" }} onClick={() => setPick({ ...pick, [r.match]: o.value })}>{o.text}</button>
                        ))}
                      </div>
                      <div className="q__actions" style={{ marginTop: 8 }}>
                        <button type="button" className="btn btn--primary" style={{ minHeight: 34 }} disabled={chosen === r.value || !writesOn} onClick={() => { onChange(r.match, chosen); setEditing(null); }}>Update answer</button>
                        <button type="button" className="btn btn--quiet" style={{ minHeight: 34 }} onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                  {s && s.phase !== "filed" && <Steps state={s.phase === "error" ? "error" : s.step} error={s.error} />}
                </div>
              );
            })}
          </div>

          <h3>Imports and changes</h3>
          {items.length === 0 ? <p className="small muted">Your first import and every change will be listed here.</p> : (
            <ol className="tl">
              {items.slice(0, 12).map((it, i) => (
                <li key={i} data-k={it.k}>{it.text}<span className="when" title={new Date(it.at).toUTCString()}>{day(it.at)}</span></li>
              ))}
            </ol>
          )}

          <div className="drawer__foot">
            <span>Demo session <button type="button" className="linkbtn" onClick={onStartOver}>Start over</button></span>
            <span>{writesOn ? "Memory writes are on." : <b style={{ color: "var(--ink)" }}>Read-only: {writesReason ?? "memory writes are switched off."}</b>}</span>
            <span>The demo memory is visible to the Walrus Memory relayer.</span>
          </div>
        </div>
      </aside>
    </>
  );
}
