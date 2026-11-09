"use client";
import { forwardRef, useEffect, useRef, type KeyboardEvent } from "react";
import { friendly, optionsFor, isContractKey } from "@/lib/answers";
import { dates, day, short } from "@/lib/format";
import { Copyable, IconCheck, Steps } from "./ui";
import type { FromMemory, Question, SaveState } from "./types";

type Props = {
  q: Question;
  value: string;                       // currently chosen answer ("" = none)
  save?: SaveState;
  canSave: boolean;                    // false in read-only mode or while memory looks incomplete
  onPick: (v: string) => void;
  onSave: () => void;
};

function Title({ k, count }: { k: string; count: number }) {
  const contract = isContractKey(k);
  return (
    <>
      {count} {contract ? (count === 1 ? "call" : "calls") : count === 1 ? "transfer" : "transfers"} {contract ? "to" : "with"}{" "}
      <span className="mark"><Copyable value={k} shown={short(k)} /></span>
    </>
  );
}

// A question that still needs an answer. Keys: 1–9 choose, Enter saves, J/K (handled in the page) move between cards.
export const QuestionCard = forwardRef<HTMLDivElement, Props>(function QuestionCard({ q, value, save, canSave, onPick, onSave }, ref) {
  const opts = optionsFor(q.key);
  const contract = isContractKey(q.key);
  const saving = save?.phase === "saving";
  const filed = save?.phase === "filed";
  const choiceRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const wasSaving = useRef(false);
  useEffect(() => { wasSaving.current = saving; }, [saving]);

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const t = e.target as HTMLElement;
    if (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA") return;
    if (saving || filed) return;
    const n = Number(e.key);
    if (n >= 1 && n <= opts.length) { e.preventDefault(); onPick(opts[n - 1].value); choiceRefs.current[n - 1]?.focus(); return; }
    // Enter saves from the card itself, or from an option that is already chosen
    const onCard = t === e.currentTarget;
    const onChosen = t.getAttribute("role") === "radio" && t.getAttribute("aria-checked") === "true";
    if (e.key === "Enter" && value && canSave && (onCard || onChosen)) { e.preventDefault(); onSave(); }
  }

  if (filed) {
    return (
      <div ref={ref} className="q q--done q--filed" data-qcard data-qkey={q.key} tabIndex={0} aria-label={`Filed: ${q.question}`}>
        <span className="q__tag q__tag--ok"><IconCheck /> Filed to memory</span>{" "}
        <span className="small muted">{q.count} {contract ? "calls" : "transfers"} · {short(q.key)} is {friendly(save!.value, q.key).toLowerCase()}</span>
      </div>
    );
  }

  return (
    <div ref={ref} className="q" data-qcard data-qkey={q.key} tabIndex={0} onKeyDown={onKey} aria-label={`Question: ${q.question}`}>
      <div className="q__top">
        <h3 className="q__title"><Title k={q.key} count={q.count} /></h3>
        <span className="q__tag">Needs your answer</span>
      </div>
      <p className="q__evidence">
        {contract ? "What do these calls do?" : "Who is this?"} {dates(q.first, q.last)}
        {!contract && <> · {q.out} sent, {q.in} received</>} · examples:{" "}
        {q.samples.map((m, i) => (
          <span key={m.digest}>{i > 0 && ", "}<a href={`https://suiscan.xyz/mainnet/tx/${m.digest}`} target="_blank" rel="noreferrer">{day(m.date)}</a></span>
        ))}
      </p>
      <div className="choices" role="radiogroup" aria-label={`Answer for ${short(q.key)}`}>
        {opts.map((o, i) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className="choice" disabled={saving}
            tabIndex={value ? (value === o.value ? 0 : -1) : i === 0 ? 0 : -1}
            ref={(el) => { choiceRefs.current[i] = el; }} onClick={() => onPick(o.value)}>
            <kbd aria-hidden="true">{i + 1}</kbd>{o.text}
          </button>
        ))}
      </div>
      <div className="q__actions">
        <button type="button" className="btn btn--primary" disabled={!value || saving || !canSave} onClick={onSave}>
          {save?.phase === "error" ? "Retry save" : "Save answer"}
        </button>
      </div>
      {save && (saving || save.phase === "error") && <Steps state={save.phase === "error" ? "error" : save.step} error={save.error} />}
    </div>
  );
});

// A question memory already answered: listed first, then it files itself into the drawer.
export const AnsweredCard = forwardRef<HTMLDivElement, { m: FromMemory }>(function AnsweredCard({ m }, ref) {
  const contract = isContractKey(m.key);
  return (
    <div ref={ref} className="q q--done" data-fmkey={m.key} aria-label={`Answered from memory: ${m.question}`}>
      <div className="q__top">
        <h3 className="q__title"><Title k={m.key} count={m.count} /></h3>
        <span className="q__tag q__tag--ok"><IconCheck /> Answered from memory</span>
      </div>
      <p className="q__evidence">{friendly(m.value, m.key)} · {dates(m.first, m.last)}{!contract && <> · {m.out} sent, {m.in} received</>}</p>
    </div>
  );
});
