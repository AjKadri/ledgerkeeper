"use client";
// Product-page demo: your app (a real question card) next to a simulated accountant view (the real ledger table),
// both fed from a static sample snapshot. No fetch, no memory client, nothing is saved.
import { useEffect, useRef, useState } from "react";
import { QuestionCard } from "./QuestionCard";
import { Ledger } from "./Ledger";
import { Segmented } from "./ui";
import { friendly } from "@/lib/answers";
import type { Question, Row } from "./types";

type Tab = "app" | "accountant" | "memory";

export function Demo({ question, rows, ruleText }: { question: Question; rows: Record<string, Row[]>; ruleText: Record<string, string> }) {
  const [value, setValue] = useState("");
  const [tab, setTab] = useState<Tab>("app");
  const [tried, setTried] = useState(false);
  // Self-play: after ~2 s in view with no interaction, pick "An exchange" once and flash the relabelled rows.
  // Any interaction stops it for good. Never under prefers-reduced-motion. No network either way.
  const rootRef = useRef<HTMLDivElement>(null);
  const touched = useRef(false);
  const [played, setPlayed] = useState(false);
  const [flash, setFlash] = useState(false);
  const AUTO = "kind:exchange";
  const play = () => {
    setValue(AUTO); setTried(false); setTab("app"); setPlayed(true);
    setFlash(true); setTimeout(() => setFlash(false), 1200);
  };
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => { touched.current = true; if (timer) clearTimeout(timer); };
    el.addEventListener("pointerdown", stop, { once: true });
    el.addEventListener("keydown", stop, { once: true });
    const io = new IntersectionObserver(([e]) => {
      if (timer) clearTimeout(timer);
      if (e.isIntersecting && !touched.current) timer = setTimeout(() => { if (!touched.current) { play(); io.disconnect(); } }, 2000);
    }, { threshold: 0.5 });
    io.observe(el);
    return () => { io.disconnect(); if (timer) clearTimeout(timer); el.removeEventListener("pointerdown", stop); el.removeEventListener("keydown", stop); };
  }, []);
  const replay = () => { touched.current = true; setValue(""); setFlash(false); setTimeout(play, 500); };
  const shownRows = rows[value] ?? rows[""];
  const right: Tab = tab === "memory" ? "memory" : "accountant";

  return (
    <div ref={rootRef}>
      <div className="pp-tabs">
        <Segmented label="Demo view" value={tab} onChange={(v) => setTab(v as Tab)}
          options={[{ value: "app", text: "Your app" }, { value: "accountant", text: "Accountant" }, { value: "memory", text: "Memory" }]} />
      </div>
      <div className="demo demo--tabs">
        <section className={`frame${tab === "app" ? " frame--glow" : ""}`} data-hidden={tab !== "app"} aria-label="Your app (demo)">
          <div className="frame__bar"><b>LedgerKeeper</b><span>sample wallet</span></div>
          <div className="frame__body">
            <QuestionCard q={question} value={value} canSave onPick={(v) => { setValue(v); setTried(false); }} onSave={() => { setTried(true); setTab("memory"); }} />
            <p className="small muted" role="status" style={{ marginTop: 12 }}>
              {tried
                ? <>Demo: nothing was saved. In the app, this answer is stored in your Walrus Memory as the rule under &ldquo;Memory&rdquo;.</>
                : value ? <>Answered: {friendly(value, question.key)}. The accountant side updates as you choose.</> : <>Pick an answer to see the accountant side change.</>}
            </p>
          </div>
        </section>

        <div className="demo__arrow" aria-hidden="true">
          <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14h20M17 7l7 7-7 7" /></svg>
        </div>

        <section className={`frame frame--b${tab !== "app" ? " frame--glow" : ""}${flash ? " demo--flash" : ""}`} data-hidden={tab === "app"} aria-label={right === "memory" ? "Memory (demo)" : "Accountant view (simulated)"}>
          <div className="frame__bar"><b>{right === "memory" ? "Memory" : "Accountant view"}</b><span>{right === "memory" ? "rule text, not saved" : "simulated from sample data"}</span></div>
          <div className="frame__body">
            {right === "accountant" ? (
              <Ledger rows={shownRows} exportHref="#" app="B" hideExport />
            ) : value && ruleText[value] ? (
              <div className="demo-mem">
                <p className="small muted">Your answer would be stored as one short rule:</p>
                <pre className="rule-text" style={{ marginTop: 8 }} tabIndex={0}><code>{ruleText[value]}</code></pre>
                <p className="small muted" style={{ marginTop: 8 }}>The next import, and the accountant view, label these transactions from it. In this demo it is not saved.</p>
              </div>
            ) : (
              <p className="small muted">Choose an answer on the left to see the rule it would store.</p>
            )}
          </div>
        </section>
      </div>
      <p className="caption">
        Interactive demo with sample data. Nothing is saved.
        {played && <> <button type="button" className="btn btn--pill-sm" onClick={replay}>Replay</button></>}
      </p>
    </div>
  );
}
