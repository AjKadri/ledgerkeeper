"use client";
import { useEffect, useId, useState, type ReactNode } from "react";
import { IconCheck } from "./ui";

// A number that explains itself on hover, focus or tap.
export function Tip({ text, children }: { text: string; children: ReactNode }) {
  const id = useId();
  return (
    <span className="tip tip--inline">
      <button type="button" aria-describedby={id}>{children}</button>
      <span id={id} role="tooltip">{text}</span>
    </span>
  );
}

// A one-line hint that is shown until it is dismissed, then remembered in this browser.
export function Hint({ id, children }: { id: string; children: ReactNode }) {
  const [gone, setGone] = useState(true);
  useEffect(() => {
    try { setGone(localStorage.getItem(`lk-hint-${id}`) === "1"); } catch { setGone(false); }
  }, [id]);
  if (gone) return null;
  return (
    <p className="hint-line" role="note">
      <span>{children}</span>
      <button type="button" className="hint-line__x" aria-label="Dismiss this hint"
        onClick={() => { setGone(true); try { localStorage.setItem(`lk-hint-${id}`, "1"); } catch { /* storage blocked */ } }}>Got it</button>
    </p>
  );
}

export const GUIDE_STEPS = ["First import (Jan–Jun)", "Answer the questions", "Next import (Jul–Aug)"] as const;

// The slim three-step bar for the guided sample.
export function Stepper({ step, done }: { step: 1 | 2 | 3; done: boolean }) {
  return (
    <nav className="stepper" aria-label="Guided sample, three steps">
      <ol>
        {GUIDE_STEPS.map((t, i) => {
          const n = i + 1;
          const state = n < step || (n === step && done) ? "done" : n === step ? "now" : "next";
          return (
            <li key={t} data-state={state} aria-current={n === step ? "step" : undefined}>
              <span className="stepper__n" aria-hidden="true">{state === "done" ? <IconCheck /> : n}</span>
              <span className="stepper__t"><span className="sr-only">Step {n}: </span>{t}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
