"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { APP_NAME, DISCLAIMER } from "@/lib/config";
import { shortAddr } from "@/lib/format";
import { Copyable, IconMoon, IconSun, Mark } from "./ui";

// ---------- theme: follows the system until the user picks, then remembers ----------
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => {
      const t = document.documentElement.dataset.theme;
      setDark(t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches);
    };
    read();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);
  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("lk-theme", next); } catch { /* private mode */ }
    setDark(!dark);
  }
  return (
    <button type="button" className="btn btn--quiet btn--icon" onClick={toggle} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Light theme" : "Dark theme"}>
      {dark ? <IconSun /> : <IconMoon />}
    </button>
  );
}

function usePaletteKey() {
  const [k, setK] = useState("Ctrl");
  useEffect(() => { if (/Mac|iPhone|iPad/.test(navigator.platform)) setK("\u2318"); }, []);
  return k;
}

export function Header({ wallet, onPalette, accountant, nav }: { wallet?: string; onPalette?: () => void; accountant?: boolean; nav?: ReactNode }) {
  const pk = usePaletteKey();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className="top" data-scrolled={scrolled}>
      <div className="shell top__in">
        <a className="brand" href="/" aria-label={`${APP_NAME} home`}>
          <Mark />
          <span>{accountant ? <>{APP_NAME} for accountants <small>reads with its own key</small></> : APP_NAME}</span>
        </a>
        <span className="top__space" />
        {nav}
        {wallet && <span className="top__wallet">Wallet <Copyable value={wallet} shown={shortAddr(wallet)} label="Copy wallet" /></span>}
        {onPalette && (
          <button type="button" className="btn btn--quiet no-print palette-btn" onClick={onPalette} aria-label="Open command palette" aria-keyshortcuts="Control+K Meta+K">
            <span className="small">Commands</span> <span style={{ display: "inline-flex", gap: 4 }}><kbd>{pk}</kbd><kbd>K</kbd></span>
          </button>
        )}
        <span className="no-print"><ThemeToggle /></span>
      </div>
    </header>
  );
}

// Small, quiet, one place for every honest label.
export function Trust() {
  return (
    <footer className="trust">
      <div className="shell">
        <ul>
          <li>Chain data via Tatum</li>
          <li>Memory on Walrus mainnet</li>
          <li>History from 23 Jan 2026</li>
          <li>Labelling for your accountant, not tax advice</li>
          <li>{DISCLAIMER}</li>
          <li>Demo memory is visible to the relayer</li>
        </ul>
      </div>
    </footer>
  );
}

export function Toast({ text }: { text: string }) {
  if (!text) return null;
  return <div className="toast" role="status" aria-live="polite">{text}</div>;
}

// ---------- command palette (Cmd/Ctrl+K) ----------
export type Command = { id: string; title: string; hint?: string; run: () => void };
export function Palette({ open, onClose, commands }: { open: boolean; onClose: () => void; commands: Command[] }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setQ(""); setSel(0); setTimeout(() => input.current?.focus(), 0); } }, [open]);
  if (!open) return null;
  const list = commands.filter((c) => c.title.toLowerCase().includes(q.trim().toLowerCase()));
  const run = (c?: Command) => { if (!c) return; onClose(); c.run(); };
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <input ref={input} value={q} placeholder="Type a command" aria-label="Command"
          role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={list[sel] ? `cmd-${list[sel].id}` : undefined}
          onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); onClose(); }
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(list.length - 1, s + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
            if (e.key === "Enter") { e.preventDefault(); run(list[sel]); }
          }} />
        {list.length === 0 ? <p className="palette__empty">Nothing matches. Try &ldquo;export&rdquo; or &ldquo;memory&rdquo;.</p> : (
          <ul id="palette-list" role="listbox" aria-label="Commands">
            {list.map((c, i) => (
              <li key={c.id} role="presentation">
                <button type="button" id={`cmd-${c.id}`} role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => run(c)}>
                  <span>{c.title}</span>{c.hint && <kbd>{c.hint}</kbd>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function Section({ title, note, children, id }: { title?: string; note?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="sect" id={id}>
      {title && <div className="sect__head"><h2>{title}</h2>{note && <p>{note}</p>}</div>}
      {children}
    </section>
  );
}
