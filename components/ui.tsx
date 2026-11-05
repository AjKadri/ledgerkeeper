"use client";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

// ---------- icons (plain strokes, no emoji) ----------
const base = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, className: "ico" } as const;
export const IconCheck = () => (<svg {...base}><path d="M3 8.5l3.2 3L13 4.5" /></svg>);
export const IconDownload = () => (<svg {...base}><path d="M8 2v8M4.5 7L8 10.5 11.5 7M3 13h10" /></svg>);
export const IconSearch = () => (<svg {...base}><circle cx="7" cy="7" r="4.2" /><path d="M10.2 10.2L13.5 13.5" /></svg>);
export const IconCommand = () => (<svg {...base}><path d="M5.5 5.5h5v5h-5zM5.5 5.5V4a1.5 1.5 0 10-1.5 1.5zM10.5 5.5V4A1.5 1.5 0 1112 5.5zM5.5 10.5V12A1.5 1.5 0 114 10.5zM10.5 10.5V12a1.5 1.5 0 101.5-1.5z" /></svg>);
export const IconSun = () => (<svg {...base}><circle cx="8" cy="8" r="3" /><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" /></svg>);
export const IconMoon = () => (<svg {...base}><path d="M13 9.5A5.5 5.5 0 116.5 3a4.5 4.5 0 006.5 6.5z" /></svg>);
export const IconDrawer = () => (<svg {...base}><rect x="2.5" y="3" width="11" height="10" rx="1" /><path d="M2.5 8h11M6.5 10.5h3" /></svg>);

// The mark: a filed card with a check.
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flex: "none" }}>
      <rect x="2" y="2" width="28" height="28" rx="6" fill="currentColor" />
      <rect x="7" y="9" width="18" height="15" rx="2" fill="var(--paper)" />
      <path d="M7 12.5h18" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 18.6l2.6 2.4 5-5.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------- click-to-copy for addresses, digests and blob ids ----------
export function Copyable({ value, shown, label }: { value: string; shown: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (t.current) clearTimeout(t.current); }, []);
  async function copy() {
    try { await navigator.clipboard.writeText(value); } catch { /* clipboard may be blocked; still show feedback only on success */ return; }
    setCopied(true);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setCopied(false), 1400);
  }
  return (
    <span className="copy mono">
      <button type="button" onClick={copy} title={value} aria-label={`${label ?? "Copy"} ${value}`}>{shown}</button>
      {copied && <span className="copy-tip" role="status">Copied</span>}
    </span>
  );
}

// ---------- segmented control (radiogroup, arrow keys) ----------
export function Segmented<T extends string>({ label, options, value, onChange, disabled }: {
  label: string; options: { value: T; text: ReactNode; disabled?: boolean }[]; value: T; onChange: (v: T) => void; disabled?: boolean;
}) {
  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const i = options.findIndex((o) => o.value === value);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); onChange(options[(i + 1) % options.length].value); }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); onChange(options[(i - 1 + options.length) % options.length].value); }
  }
  return (
    <div className="seg" role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} tabIndex={o.value === value ? 0 : -1}
          className="seg__opt" disabled={disabled || o.disabled} onClick={() => onChange(o.value)}>{o.text}</button>
      ))}
    </div>
  );
}

// ---------- save progress: Sent, Stored on Walrus, Searchable ----------
export type StepState = "sent" | "stored" | "searchable" | "error";
const ORDER: StepState[] = ["sent", "stored", "searchable"];
export function Steps({ state, error }: { state: StepState; error?: string }) {
  if (state === "error") return <p className="steps" role="alert"><span className="steps__err">{error ?? "Not saved. Retry."}</span></p>;
  const at = ORDER.indexOf(state);
  const names = ["Sent", "Stored on Walrus", "Searchable"];
  const st = (i: number) => (i < at ? "done" : i === at ? (state === "searchable" ? "done" : "active") : "todo");
  return (
    <p className="steps" aria-live="polite">
      {names.map((n, i) => (
        <span key={n} style={{ display: "inline-flex", alignItems: "center" }}>
          {i > 0 && <span className="steps__bar" aria-hidden="true" />}
          <span className="step" data-state={st(i)}>{n}</span>
        </span>
      ))}
    </p>
  );
}
