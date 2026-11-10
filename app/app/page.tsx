"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ADDRESS_RE, DEMO_WALLET, IMPORT_SPLIT } from "@/lib/config";
import dynamic from "next/dynamic";
import { checkAddress } from "@/lib/address";
import { friendly, ruleFromValue } from "@/lib/answers";
import { forgetOwn, loadOwn, type OwnMemory } from "@/lib/byo-store";
import { outageText, OUTAGE_NO_SAVE } from "@/lib/stale";
// The wallet, SDK and chain code is only loaded when own-memory mode is used.
const byo = () => import("@/lib/byo");
import { fly } from "@/lib/fly";
import { outcomeChanged } from "@/lib/learning";
import { dates, prefersReducedMotion, short, usd as usdFmt } from "@/lib/format";
import { Header, Palette, Section, Toast, Trust, type Command } from "@/components/Chrome";
import { Drawer, rangeText } from "@/components/Drawer";
import { Ledger, Skeleton } from "@/components/Ledger";
import { AnsweredCard, QuestionCard } from "@/components/QuestionCard";
import { Hint, Stepper, Tip } from "@/components/Guide";
import { IconDrawer, IconInfo, Segmented } from "@/components/ui";
import { toDrawer, type DrawerData, type FromMemory, type Question, type RawRules, type Row, type SaveState } from "@/components/types";

type Counts = { asked: number; repeat: number; new: number };
type ImportResult = {
  address: string; from?: string; to?: string; txCount: number; source: string; cachedAt?: string; note?: string; memory: boolean;
  labelCounts: Record<string, number>; questions: Question[]; counts: { on: Counts; off: Counts }; reused: number;
  previousOutcome: { range: string; txs: number; asked: number; answered: number; reused: number; blob: string } | null;
  sameRangeOutcome: { range: string; txs: number; asked: number; answered: number; reused: number } | null;
  updates: { match: string; from: string; to: string }[];
  usd: { basis: string; priced: number; of: number; received: number; sent: number };
  answeredFromMemory: FromMemory[]; rows: Row[]; drawer: RawRules;
  writes: { ok: boolean; reason?: string };
  stale: { at: string } | null;
  memoryStats: { rules: number; outcomes: number; listed: number; incomplete: boolean };
};

const OwnMemoryPanel = dynamic(() => import("@/components/OwnMemory").then((m) => m.OwnMemoryPanel), { ssr: false, loading: () => <p className="small muted">Loading wallet support…</p> });

const rand = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Home() {
  const [session, setSession] = useState("");
  const [address, setAddress] = useState("");
  const [memory, setMemory] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errorReason, setErrorReason] = useState<string | undefined>();
  const [res, setRes] = useState<ImportResult | null>(null);
  const [which, setWhich] = useState("");
  const [saves, setSaves] = useState<Record<string, SaveState>>({});
  const [pick, setPick] = useState<Record<string, string>>({});
  const [drawer, setDrawer] = useState<DrawerData | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(true);
  const [writes, setWrites] = useState<{ ok: boolean; reason?: string }>({ ok: true });
  const [outcome, setOutcome] = useState<"saving" | "saved" | "error" | "unchanged" | null>(null);
  const [toast, setToast] = useState("");
  const [palette, setPalette] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [pulse, setPulse] = useState<string[]>([]);
  const [seq, setSeq] = useState<"idle" | "running" | "done">("idle");
  const [shownRepeat, setShownRepeat] = useState(0);
  const [mode, setMode] = useState<"sample" | "own" | null>(null);
  const [memMode, setMemMode] = useState<"demo" | "own">("demo");
  const [own, setOwn] = useState<OwnMemory | null>(null);
  const [gstep, setGstep] = useState<1 | 2 | 3>(1);

  const inflight = useRef(new Set<string>());
  const outcomeFor = useRef<ImportResult | null>(null);
  const savesRef = useRef(saves); savesRef.current = saves;
  const drawerRef = useRef(drawer); drawerRef.current = drawer;
  const sessionRef = useRef(session); sessionRef.current = session;
  const ownRef = useRef(own); ownRef.current = own;
  const memModeRef = useRef(memMode); memModeRef.current = memMode;
  const usingOwn = memMode === "own" && !!own;
  const lastRun = useRef<{ name: string; range: { from?: string; to?: string }; addr: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((t: string) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  }, []);

  // ---------- session and first load ----------
  useEffect(() => {
    let s = "";
    try { s = localStorage.getItem("lk-session") ?? ""; } catch { /* storage blocked */ }
    if (!/^lk-[a-f0-9]{16}$/.test(s)) { s = "lk-" + rand(8); try { localStorage.setItem("lk-session", s); } catch { /* storage blocked */ } }
    setSession(s);
    const o = loadOwn(); if (o) { setOwn(o); try { if (localStorage.getItem("lk-mem-mode") === "own") setMemMode("own"); } catch { /* storage blocked */ } }
    fetch("/api/status").then((r) => r.json()).then((j) => setWrites({ ok: j.writesEnabled, reason: j.reason ?? undefined })).catch(() => {});
  }, []);

  const refreshDrawer = useCallback(async (ns = sessionRef.current): Promise<DrawerData | null> => {
    if (!ns) return null;
    try {
      let j: any, ok = true;
      if (ownRef.current && memModeRef.current === "own") j = await (await byo()).ownRecall(ownRef.current);
      else { const r = await fetch(`/api/rules?as=A&namespace=${ns}`); j = await r.json(); ok = r.ok; }
      if (ok) { const d = toDrawer(j); setDrawer(d); return d; }
    } catch { /* keep what is shown */ } finally { setDrawerLoading(false); }
    return null;
  }, []);
  useEffect(() => { if (session && (memMode === "demo" || own)) refreshDrawer(session); }, [session, refreshDrawer, memMode, own]);

  function newSession() {
    const s = "lk-" + rand(8);
    try { localStorage.setItem("lk-session", s); } catch { /* storage blocked */ }
    setSession(s); setRes(null); setSaves({}); setPick({}); setDrawer(null); setOutcome(null); setError(""); setEditing(null);
    outcomeFor.current = null; lastRun.current = null; setDrawerLoading(true); setMode(null); setGstep(1); setAddress("");
    say("Started over. Your memory drawer is empty.");
  }

  // ---------- import ----------
  async function run(name: string, range: { from?: string; to?: string }, o?: { memory?: boolean; addr?: string }) {
    if (memMode === "own" && !own) { say("Finish setting up your own memory first."); return; }
    const addr = o?.addr ?? address, mem = o?.memory ?? memory;
    setBusy(true); setError(""); setErrorReason(undefined); setWhich(name); lastRun.current = { name, range, addr };
    try {
      const ruleSet = usingOwn ? await (await byo()).ownRecall(own!) : undefined;
      const resp = await fetch("/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: addr, namespace: session, memory: mem, ruleSet, ...range }) });
      const j: ImportResult = await resp.json();
      if (!resp.ok) { const f = j as unknown as { error: string; reason?: string }; setErrorReason(f.reason); throw new Error(f.error); }
      setErrorReason(undefined);
      setSaves({}); setPick({}); setOutcome(null); setEditing(null); outcomeFor.current = null;
      setWrites(j.writes); setDrawer(toDrawer(j.drawer)); setDrawerLoading(false);
      setRes(j);
    } catch (e) { setError((e as Error).message); setRes(null); } finally { setBusy(false); }
  }
  const tryAnother = () => { setError(""); setErrorReason(undefined); setAddress(""); setTimeout(() => document.getElementById("addr")?.focus(), 50); };
  const runSample = () => { setAddress(DEMO_WALLET); setMode("sample"); setGstep(1); run("First import (Jan–Jun)", { to: IMPORT_SPLIT.import1.to }, { addr: DEMO_WALLET, memory: true }); setMemory(true); };
  const runOwn = (a = address) => { setMode("own"); setMemory(true); run("Import", {}, { addr: a, memory: true }); };
  const runNext = () => { setGstep(3); setMemory(true); run("Next import (Jul–Aug)", IMPORT_SPLIT.import2, { addr: DEMO_WALLET, memory: true }); };
  const goBack = () => {
    if (gstep === 3) { setGstep(2); setMemory(true); run("First import (Jan–Jun)", { to: IMPORT_SPLIT.import1.to }, { addr: DEMO_WALLET, memory: true }); }
    else if (gstep === 2) setGstep(1);
  };
  const tryOwn = () => { setMode(null); setRes(null); setError(""); setAddress(""); setGstep(1); setTimeout(() => document.getElementById("addr")?.focus(), 50); };

  // Links from the product page: /app?sample=1 starts the guided sample, /app?address=0x… imports that wallet.
  const launched = useRef(false);
  useEffect(() => {
    if (!session || launched.current) return;
    launched.current = true;
    const q = new URLSearchParams(window.location.search);
    const a = q.get("address") ?? q.get("wallet") ?? "";
    if (q.get("sample") === "1") { window.history.replaceState(null, "", "/app"); runSample(); }
    else if (ADDRESS_RE.test(a)) { window.history.replaceState(null, "", "/app"); setAddress(a); runOwn(a); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // ---------- the filing moment: questions memory already answered fly into the drawer ----------
  const flyTarget = (key: string) => (window.innerWidth < 1024
    ? document.querySelector<HTMLElement>("[data-dock]")
    : document.querySelector<HTMLElement>(`[data-rule="${key.toLowerCase()}"]`));

  useEffect(() => {
    if (!res) return;
    const fm = res.memory ? res.answeredFromMemory : [];
    if (fm.length === 0 || prefersReducedMotion()) { setSeq("done"); setShownRepeat(res.memory ? res.counts.on.repeat : res.counts.off.repeat); return; }
    let cancelled = false;
    setSeq("running"); setShownRepeat(res.counts.off.repeat);
    try { performance.mark("lk-filing-start"); } catch { /* marks are optional */ }
    (async () => {
      await sleep(300);
      const step = fm.length > 1 ? Math.min(160, 450 / (fm.length - 1)) : 0;
      await Promise.all(fm.map(async (m, i) => {
        await sleep(i * step);
        if (cancelled) return;
        await fly(document.querySelector<HTMLElement>(`[data-fmkey="${m.key}"]`), flyTarget(m.key), 520);
        if (cancelled) return;
        setShownRepeat((n) => Math.max(res.counts.on.repeat, n - 1));
        const k = m.key.toLowerCase();
        setPulse((p) => [...p, k]); setTimeout(() => setPulse((p) => p.filter((x) => x !== k)), 900);
      }));
      await sleep(180);
      if (!cancelled) { setSeq("done"); try { performance.mark("lk-filing-end"); } catch { /* optional */ } }
    })();
    return () => { cancelled = true; };
  }, [res]);

  // ---------- saving an answer: Sent -> Stored on Walrus -> Searchable, then it files into the drawer ----------
  const jobStatus = async (id: string): Promise<{ status: string }> =>
    usingOwn ? (await byo()).ownJob(own!, id) : (await fetch(`/api/job?namespace=${session}&id=${encodeURIComponent(id)}`)).json();
  const setSave = (k: string, s: SaveState) => setSaves((p) => ({ ...p, [k]: s }));
  async function save(match: string, value: string, fromDrawer = false) {
    const key = match.toLowerCase();
    if (inflight.current.has(key)) return; // double click guard
    inflight.current.add(key);
    const prev = drawerRef.current?.rules.find((r) => r.match === key)?.value;
    const old = savesRef.current[match] ?? savesRef.current[key];
    const answerId = old?.phase === "error" && old.value === value ? old.answerId : rand(8);
    const base = { value, answerId, prev };
    setSave(match, { ...base, phase: "saving", step: "sent" });
    try {
      let j: { jobId: string };
      if (usingOwn) {
        const rule = ruleFromValue(key, value); if (!rule) throw new Error("Invalid answer.");
        j = await (await byo()).ownSaveRule(own!, rule, answerId);
      } else {
        const r = await fetch("/api/answer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ namespace: session, match, value, answerId }) });
        j = await r.json();
        if (!r.ok) throw new Error((j as unknown as { error: string }).error);
      }
      let done = false;
      for (let i = 0; i < 90 && !done; i++) {
        await sleep(2000);
        try {
          const s = await jobStatus(j.jobId);
          if (s.status === "uploaded" || s.status === "done") setSave(match, { ...base, phase: "saving", step: "stored" });
          if (s.status === "done") done = true;
          if (s.status === "failed" || s.status === "not_found") throw new Error("failed");
        } catch (e) { if ((e as Error).message === "failed") throw e; /* a poll hiccup: try again */ }
      }
      if (!done) throw new Error("The save is taking longer than usual. Retry.");
      // searchable = a fresh recall returns the rule
      let found = false;
      for (let i = 0; i < 12 && !found; i++) {
        const d = await refreshDrawer();
        found = !!d?.rules.find((x) => x.match === key && x.value === value);
        if (!found) await sleep(2000);
      }
      if (!found) throw new Error("Saved, but memory has not caught up yet. Retry to check again.");
      setSave(match, { ...base, phase: "saving", step: "searchable" });
      await sleep(250);
      if (!fromDrawer) await fly(document.querySelector<HTMLElement>(`[data-qkey="${match}"]`), flyTarget(key), 560);
      setSave(match, { ...base, phase: "filed", step: "searchable" });
      setPulse((p) => [...p, key]); setTimeout(() => setPulse((p) => p.filter((x) => x !== key)), 900);
      say(prev && prev !== value ? "Updated in your memory" : "Saved to your memory");
    } catch (e) {
      const m = (e as Error).message;
      setSave(match, { ...base, phase: "error", step: "sent", error: m === "failed" ? "Not saved. Retry." : `${m.replace(/\.$/, "")}. You can retry.` });
    } finally { inflight.current.delete(key); }
  }

  // ---------- the import outcome: written once nothing is left to answer ----------
  const recordOutcome = useCallback(async (r: ImportResult, answered: number) => {
    if (outcomeFor.current === r) return;
    outcomeFor.current = r;
    if (!r.writes.ok) return;
    const rg = `${r.from ?? "start"}..${r.to ?? "now"}`;
    const next = { wallet: r.address, range: rg, txs: r.txCount, asked: r.counts.on.asked, answered, reused: r.reused };
    const p = r.sameRangeOutcome;
    if (!outcomeChanged(p ? { wallet: r.address, range: p.range, txs: p.txs, asked: p.asked, answered: p.answered, reused: p.reused } : null, next)) { setOutcome("unchanged"); return; }
    setOutcome("saving");
    try {
      let j: { jobId: string };
      if (usingOwn) j = await (await byo()).ownSaveOutcome(own!, next);
      else {
        const resp = await fetch("/api/outcome", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
          namespace: session, address: next.wallet, range: next.range, txs: next.txs, asked: next.asked, answered: next.answered, reused: next.reused }) });
        j = await resp.json(); if (!resp.ok) throw new Error((j as unknown as { error: string }).error);
      }
      for (let i = 0; i < 60; i++) {
        await sleep(2000);
        const s = await jobStatus(j.jobId);
        if (s.status === "done") { setOutcome("saved"); await refreshDrawer(); say("Import outcome saved to your memory"); return; }
        if (s.status === "failed" || s.status === "not_found") break;
      }
      setOutcome("error");
    } catch { setOutcome("error"); }
  }, [session, refreshDrawer, say, usingOwn, own]);

  useEffect(() => {
    if (!res || outcomeFor.current === res) return;
    const qs = res.questions;
    const filed = qs.filter((q) => saves[q.key]?.phase === "filed").length;
    if (qs.length === 0 || filed === qs.length) recordOutcome(res, filed);
  }, [res, saves, recordOutcome]);

  // ---------- keyboard: J/K between question cards, Cmd/Ctrl+K palette ----------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); return; }
      if (e.key === "Escape") { setSheet(false); return; }
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || palette) return;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable) return;
      if (e.key !== "j" && e.key !== "k") return;
      const cards = [...document.querySelectorAll<HTMLElement>("[data-qcard]:not(.q--filed)")];
      if (!cards.length) return;
      const cur = cards.findIndex((c) => c === document.activeElement || c.contains(document.activeElement));
      const next = e.key === "j" ? Math.min(cards.length - 1, cur + 1) : Math.max(0, cur === -1 ? 0 : cur - 1);
      e.preventDefault(); cards[next].focus(); cards[next].scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [palette]);

  // ---------- derived ----------
  const addr = checkAddress(address);
  const c = res?.counts;
  const stale = drawer?.stale ?? null;                       // Walrus Memory unreadable: showing the last good read
  const readOnly = !usingOwn && !writes.ok && !stale;
  const incomplete = !!res?.memoryStats.incomplete || !!drawer?.incomplete;
  const canSave = (usingOwn || writes.ok) && !incomplete && !stale;
  const exportHref = res ? `/api/export?as=A&address=${res.address}&namespace=${session}` : "#";
  const accountantHref = usingOwn ? "#" : res ? `/accountant?address=${res.address}&ns=${session}` : "#";
  const questions = res?.questions ?? [];
  const showFm = !!res && res.memory && res.answeredFromMemory.length > 0;
  const guided = mode === "sample";
  const filed = questions.filter((q) => saves[q.key]?.phase === "filed").length;
  const allDone = questions.length === 0 || filed === questions.length;
  const unknownRows = res ? res.rows.filter((r) => r.label === "unknown").length : 0;
  const labelled = res ? res.rows.length - unknownRows : 0;
  const showFinal = !!res && !busy && seq === "done" && allDone && (guided ? gstep === 3 : true);
  const bigRepeat = seq === "running" ? shownRepeat : res ? (res.memory ? res.counts.on.repeat : res.counts.off.repeat) : 0;

  const jumpToRule = useCallback((match: string) => {
    const m = match.toLowerCase();
    setSheet(true);
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-rule="${m}"]`);
      el?.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
      el?.focus({ preventScroll: true });
      setPulse([m]); setTimeout(() => setPulse([]), 900);
    }, 60);
  }, []);

  function chooseMem(m: "demo" | "own") {
    if (m === memMode) return;
    setMemMode(m); memModeRef.current = m;
    try { localStorage.setItem("lk-mem-mode", m); } catch { /* storage blocked */ }
    setRes(null); setSaves({}); setPick({}); setDrawer(null); setOutcome(null); setError(""); setMode(null); setEditing(null);
    outcomeFor.current = null; lastRun.current = null; setDrawerLoading(true);
    if (m === "demo") fetch("/api/status").then((r) => r.json()).then((j) => setWrites({ ok: j.writesEnabled, reason: j.reason ?? undefined })).catch(() => {});
  }
  async function exportOwn() {
    if (!res || !own) { say("Import a wallet first."); return; }
    try {
      const r = await fetch("/api/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: res.address, ruleSet: await (await byo()).ownRecall(own) }) });
      if (!r.ok) throw new Error((await r.json()).error);
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a"); a.href = url; a.download = "ledgerkeeper-own-memory.csv"; a.click(); URL.revokeObjectURL(url);
    } catch (e) { say((e as Error).message || "Export failed."); }
  }

  const commands: Command[] = useMemo(() => [
    { id: "sample", title: "Import the sample wallet", run: runSample },
    { id: "imp1", title: "Sample wallet: first import (Jan–Jun)", run: () => runFor("First import (Jan–Jun)", { to: IMPORT_SPLIT.import1.to }) },
    { id: "imp2", title: "Sample wallet: next import (Jul–Aug)", run: () => runFor("Next import (Jul–Aug)", IMPORT_SPLIT.import2) },
    { id: "impall", title: "Import full history", run: () => runFor("Full history", {}) },
    { id: "new", title: "Start over (new demo session)", run: newSession },
    { id: "export", title: "Export CSV", run: () => { if (usingOwn) exportOwn(); else if (res) window.location.href = exportHref; else say("Import a wallet first."); } },
    { id: "acct", title: "Open the accountant view", run: () => { if (usingOwn) say("The accountant view works with the demo memory only, for now."); else if (res) window.open(accountantHref, "_blank"); else say("Import a wallet first."); } },
    { id: "memory", title: memory ? "Show this import without your memory" : "Show this import with your memory", run: () => switchMemory(memory ? "off" : "on") },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [res, memory, exportHref, accountantHref, session, address, usingOwn, own]);

  // Runs an import for the address in the field, or the sample wallet if the field is empty or not valid yet.
  function runFor(name: string, range: { from?: string; to?: string }) {
    const a = checkAddress(address).ok ? address : DEMO_WALLET;
    if (a !== address) setAddress(a);
    run(name, range, { addr: a });
  }

  function switchMemory(v: "on" | "off") {
    const on = v === "on";
    setMemory(on);
    if (lastRun.current && res) run(lastRun.current.name, lastRun.current.range, { memory: on, addr: lastRun.current.addr });
  }

  const rangeButtons = mode === "sample" ? (
    <p className="small muted" style={{ marginTop: 12 }}>
      Guided sample: a public wallet with a fictional owner.{" "}
      <button type="button" className="linkbtn" disabled={busy || !session} onClick={() => { setMode("own"); setMemory(true); run("Full history", {}, { addr: DEMO_WALLET, memory: true }); }}>Import its full history instead</button>
    </p>
  ) : (
    <div className="rangebar" role="group" aria-label="Import">
      <button type="button" className="btn btn--primary" disabled={busy || !addr.ok || !session} onClick={() => runOwn()}>Import</button>
    </div>
  );

  const field = (big: boolean) => (
    <div>
      <label htmlFor="addr" className={big ? "sr-only" : "small muted"}>Sui address</label>
      <input id="addr" className="field" value={address} spellCheck={false} autoComplete="off" autoCapitalize="off" placeholder="0x…" aria-describedby="addr-hint"
        aria-invalid={!!address && !addr.ok && address.length >= 66 ? true : undefined}
        onChange={(e) => setAddress(e.target.value.trim())} onKeyDown={(e) => { if (e.key === "Enter" && addr.ok && !busy) runOwn(); }} />
      <p id="addr-hint" className={`hint${!big && addr.ok ? " sr-only" : ""} ${addr.ok ? "hint--ok" : address && (/[^0-9a-fx]/i.test(address.slice(1)) || address.length > 66) ? "hint--bad" : ""}`} aria-live="polite">{addr.text}</p>
    </div>
  );

  const memChoice = (
    <div className="memchoice">
      <Segmented label="Memory" value={memMode} onChange={chooseMem} disabled={busy}
        options={[{ value: "demo", text: "Demo memory" }, { value: "own", text: "Use my own memory (beta)" }]} />
      {memMode === "own" && (
        <OwnMemoryPanel own={own} rules={drawer?.rules.length} onReady={(m) => { setOwn(m); ownRef.current = m; }} onForget={() => { forgetOwn(); setOwn(null); ownRef.current = null; setDrawer(null); setRes(null); setSaves({}); setOutcome(null); say("This browser forgot your key."); }} />
      )}
    </div>
  );

  const started = !!res || busy || !!error;

  return (
    <>
      <Header wallet={res?.address} onPalette={() => setPalette(true)} />
      <div className="shell layout">
        <main className="main" aria-busy={busy}>
          {stale && (
            <div className="banner banner--warn" role="status">
              <b>{outageText(stale)}</b> {OUTAGE_NO_SAVE}
            </div>
          )}
          {readOnly && (
            <div className="banner banner--warn" role="status">
              <b>Read-only mode.</b> {writes.reason ?? "Memory writes are switched off."} Rules already saved are still applied and the export works, but new answers cannot be saved right now.
            </div>
          )}

          {!started && (
            <section className="hero app-start">
              <h1>Label your Sui history for your accountant. Answer each question once.</h1>
              <p className="lead">Your answers are kept in your Walrus Memory, so the next import, and any app you allow, starts from what you already told it. New here? Try the sample: it takes about two minutes.</p>
              <div className="hero__form">
                {field(true)}
                <div className="hero__actions">
                  <button type="button" className={`btn${memMode === "own" ? " btn--primary" : ""}`} disabled={!addr.ok || busy || !session} onClick={() => runOwn()}>Import</button>
                  {memMode === "demo" && <button type="button" className="btn btn--primary" disabled={busy || !session} onClick={runSample}>Try the sample wallet</button>}
                  <span className="small muted">{memMode === "demo" ? "The sample is a public wallet with a fictional owner." : "The sample wallet is available with the demo memory only."}</span>
                </div>
                {memChoice}
              </div>
              <div className="howto">
                <div><h3>Import</h3><p>Paste any Sui address. History comes through Tatum, the newest 500 transactions, from 23 Jan 2026.</p></div>
                <div><h3>Answer once</h3><p>Each unclear counterparty or contract is asked about one time. The answer is filed as a rule in your Walrus Memory.</p></div>
                <div><h3>Hand over</h3><p>Export a labelled CSV, or open the accountant view, which reads the same rules with its own key.</p></div>
              </div>
            </section>
          )}

          {started && (
            <Section>
              <div className="walletbar">{field(false)}</div>
              {memChoice}
              {rangeButtons}
              {error && errorReason === "no_recent_activity" && (
                <div className="calm" role="status" data-testid="no-activity">
                  <span className="calm__ico" aria-hidden="true"><IconInfo /></span>
                  <div>
                    <h2 className="calm__title">No activity we can read yet</h2>
                    <p>This wallet hasn&rsquo;t moved since before 23 Jan 2026, the earliest history available. Try a wallet you&rsquo;ve used since February, or the sample wallet.</p>
                    <div className="calm__actions">
                      <button type="button" className="btn btn--primary" onClick={tryAnother}>Try another address</button>
                      <button type="button" className="btn" onClick={runSample}>Try the sample wallet</button>
                    </div>
                  </div>
                </div>
              )}
              {error && errorReason !== "no_recent_activity" && (
                <div className="calm calm--bad" role="alert">
                  <span className="calm__ico" aria-hidden="true"><IconInfo /></span>
                  <div>
                    <h2 className="calm__title">Could not import.</h2>
                    <p>{error}</p>
                    <div className="calm__actions"><button type="button" className="btn" onClick={runSample}>Try the sample wallet</button></div>
                  </div>
                </div>
              )}
            </Section>
          )}

          {busy && !res && (
            <Section title="Importing">
              <p className="small muted" role="status">Reading the history through Tatum and checking your memory…</p>
              <div style={{ marginTop: 16 }}><Skeleton /></div>
            </Section>
          )}

          {res && c && (
            <div style={busy ? { opacity: 0.55 } : undefined}>
              {guided && (
                <Section>
                  <Stepper step={gstep} done={gstep === 3 ? seq === "done" : gstep === 2 ? allDone && questions.length > 0 : false} />
                </Section>
              )}
              <Section>
                <div className="card result">
                <p className="result__meta">
                  {which}: <span className="num">{res.txCount}</span> transactions ({res.source === "cached" ? `cached at ${res.cachedAt}` : "live from Tatum"}){res.note ? ` · ${res.note}` : ""}
                  {outcome && <> · import outcome {outcome === "saving" ? "saving…" : outcome === "saved" ? "saved" : outcome === "unchanged" ? "unchanged, not written again" : "not saved"}</>}
                </p>

                {guided && gstep === 1 && (
                  <>
                    <h1 className="big" aria-live="polite">
                      LedgerKeeper labelled <Tip text="Labelled by the built-in rules and by any answer already in your memory."><span className="num">{labelled}</span></Tip> of <span className="num">{res.rows.length}</span> transactions. <span className="num">{questions.length}</span> {questions.length === 1 ? "needs" : "need"} you.
                    </h1>
                    <p className="big__sub">{questions.length > 0 ? "Each question is about one counterparty or contract. Answer it once and it is remembered." : "Nothing is left to ask in this range."}</p>
                    <div className="guidebar"><button type="button" className="btn btn--primary" onClick={() => { setGstep(2); setTimeout(() => document.getElementById("questions")?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" }), 30); }}>
                      {questions.length > 0 ? `Answer ${questions.length} question${questions.length === 1 ? "" : "s"}` : "Continue"}
                    </button></div>
                  </>
                )}

                {guided && gstep === 2 && (
                  <>
                    <h1 className="big" aria-live="polite">{questions.length === 0 ? "Everything here was answered from memory" : allDone ? "All answered. They are in your memory." : `Answer ${questions.length} question${questions.length === 1 ? "" : "s"}`}</h1>
                    {questions.length > 0 && (
                      <>
                        <p className="big__sub"><b className="num">{filed}</b> of <span className="num">{questions.length}</span> answered</p>
                        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={filed} aria-label="Questions answered"><span style={{ width: `${(filed / questions.length) * 100}%` }} /></div>
                      </>
                    )}
                    <div className="guidebar">
                      <button type="button" className="btn btn--quiet" onClick={goBack} disabled={busy}>Back</button>
                      <button type="button" className="btn btn--primary" disabled={busy || (questions.length > 0 && !allDone)} onClick={runNext}>Next: import Jul–Aug</button>
                      {questions.length > 0 && !allDone && <span className="small muted">Answer all {questions.length} to continue.</span>}
                    </div>
                  </>
                )}

                {guided && gstep === 3 && busy && <h1 className="big" aria-live="polite">Importing Jul–Aug…</h1>}
                {(!guided || (gstep === 3 && !busy)) && (
                  <>
                    <h1 className="big" aria-live="polite">
                      <Tip text="Questions you answered in an earlier import that you would have to answer again. With your memory this should be zero."><span className="mark"><span className="num">{bigRepeat}</span> question{bigRepeat === 1 ? "" : "s"} you&rsquo;d have answered again</span></Tip>
                    </h1>
                    <p className="big__sub">
                      {res.memory
                        ? <><Tip text="Questions your memory already had an answer for, so you were not asked."><b className="num">{res.counts.off.repeat}</b> answered from memory</Tip> · <Tip text="Questions this import asks for the first time."><b className="num">{c.on.new}</b> new</Tip></>
                        : <><b className="num">{res.counts.off.repeat}</b> you would be asked again · <b className="num">{c.off.new}</b> new</>}
                    </p>


                    {res.previousOutcome ? (
                      <p className="outcome-line">
                        {res.previousOutcome.asked === 0
                          ? <>Last time ({rangeText(res.previousOutcome.range)}) everything was answered from memory, <b className="num">{res.previousOutcome.reused}</b> reused.</>
                          : <>Last time ({rangeText(res.previousOutcome.range)}) you answered <b className="num">{res.previousOutcome.answered}</b> of <span className="num">{res.previousOutcome.asked}</span> questions.</>}{" "}
                        This time: <b className="num">{c.on.new}</b> new question{c.on.new === 1 ? "" : "s"}, <b className="num">{res.reused}</b> reused from memory.{" "}
                        <span className="small muted">From your import outcome memory.</span>
                      </p>
                    ) : <p className="outcome-line muted">No earlier import is recorded in this memory yet.</p>}
                    <div className="compare">
                      <Segmented label="Show this import" value={memory ? "on" : "off"} onChange={switchMemory} disabled={busy}
                        options={[{ value: "on", text: "With your memory" }, { value: "off", text: "Without it" }]} />
                      <div className="compare__col compare__col--on"><div className="k">With your memory</div><div className="v num">{c.on.asked} asked</div><div className="d num">{c.on.repeat} you&rsquo;d answer again · {c.on.new} new</div></div>
                      <div className="compare__col"><div className="k">Without it</div><div className="v num">{c.off.asked} asked</div><div className="d num">{c.off.repeat} you&rsquo;d answer again · {c.off.new} new</div></div>
                    </div>
                    <details className="howcount">
                      <summary>How we count</summary>
                      <div>
                    <p className="small muted">Questions you&rsquo;d have answered again: <span className="num">{c.on.repeat}</span> with your memory / <span className="num">{c.off.repeat}</span> without it</p>
                        {res.usd.priced > 0 && !busy && (
                  <p className="usd">
                    <Tip text="Approximate. SUI amounts valued at the Cetus SUI/USDC pool price at that time. Other coins are not valued."><b>USD value of SUI legs</b></Tip> (approximate, on-chain pool price): received <b className="num">{usdFmt(res.usd.received)}</b>, sent <b className="num">{usdFmt(Math.abs(res.usd.sent))}</b> across <span className="num">{res.usd.priced}</span> of <span className="num">{res.usd.of}</span> transactions. Other coins (for example CETUS) are not valued.
                  </p>
                        )}
                      </div>
                    </details>
                    {guided && <div className="guidebar"><button type="button" className="btn btn--quiet" onClick={goBack} disabled={busy}>Back</button></div>}
                  </>
                )}

                {res.updates.map((u) => (
                  <p key={u.match} className="small wrap" style={{ marginTop: 12, color: "var(--green)" }}>
                    Updated from {friendly(u.from, u.match)} to {friendly(u.to, u.match)}: <span className="mono">{short(u.match)}</span>. The newest answer wins.
                  </p>
                ))}
                {incomplete && <div className="banner banner--bad" role="alert" style={{ marginTop: 16 }}><b>Memory returned fewer items than it holds.</b> Some saved answers may be missing, so saving is paused. Run the import again before answering.</div>}
                </div>
              </Section>

              {(!guided || gstep >= 2) && (
                <Section title="Questions" id="questions" note={questions.length > 0 ? <>J and K move between cards · <kbd>1</kbd>–<kbd>4</kbd> choose · <kbd>Enter</kbd> saves</> : undefined}>
                  <div className="qlist">
                    {questions.length > 0 && <Hint id="question">Choose what fits and save. You answer each one only once; it is remembered next time.</Hint>}
                    {showFm && seq === "running" && res.answeredFromMemory.map((m) => <AnsweredCard key={m.key} m={m} />)}
                    {showFm && seq === "done" && (
                      <p className="small muted" style={{ marginBottom: 16 }}>
                        <b style={{ color: "var(--green)" }}>{res.answeredFromMemory.length} answered from memory</b> and filed in your drawer: {res.answeredFromMemory.map((m) => `${short(m.key)} (${friendly(m.value, m.key).toLowerCase()})`).join(", ")}.
                      </p>
                    )}
                    {questions.map((q) => (
                      <QuestionCard key={q.key} q={q} value={pick[q.key] ?? ""} save={saves[q.key]} canSave={canSave}
                        onPick={(v) => setPick((p) => ({ ...p, [q.key]: v }))} onSave={() => save(q.key, pick[q.key])} />
                    ))}
                    {questions.length === 0 && (
                      <p>Nothing left to answer. Every transaction in this import is labelled{res.memory && res.answeredFromMemory.length > 0 ? ", using your saved rules" : ""}.</p>
                    )}
                  </div>
                </Section>
              )}

              {showFinal && (
                <Section>
                  <div className="final">
                    <div>
                      <h2>Send it to your accountant</h2>
                      {usingOwn ? (
                        <>
                          <p>Download the labelled CSV for your accountant. The accountant view reads the demo memory only, for now; your own memory is read with the key in this browser.</p>
                          <button type="button" className="btn btn--primary" onClick={exportOwn}>Download CSV</button>
                        </>
                      ) : (
                        <>
                          <p>The accountant view is a separate app. It reads the same rules from your memory with its own key, so nothing is typed in again.</p>
                          <a className="btn btn--primary" href={accountantHref} target="_blank" rel="noreferrer">Open the accountant view</a>
                        </>
                      )}
                    </div>
                    <div>
                      <h2>Try your own wallet</h2>
                      <p>Paste any Sui address. History is available from 23 Jan 2026.</p>
                      <button type="button" className="btn" onClick={tryOwn}>Use my wallet</button>
                    </div>
                  </div>
                </Section>
              )}

              <Section title="Transactions" note={`${res.rows.length} rows, ${dates(res.rows[0]?.date.slice(0, 10) ?? "", res.rows[res.rows.length - 1]?.date.slice(0, 10) ?? "")}`}>
                <Ledger rows={res.rows} onJumpRule={jumpToRule} exportHref={exportHref} onExport={usingOwn ? exportOwn : undefined} app="A" />
                <p className="small muted no-print" style={{ marginTop: 16 }}>
                  {usingOwn
                    ? <>Sending this to your accountant? Download the CSV above. The accountant view works with the demo memory only, for now.</>
                    : <>Sending this to your accountant? <a href={accountantHref} target="_blank" rel="noreferrer">Open the accountant view</a>, a separate app that reads the same rules with its own key.</>}
                </p>
              </Section>
            </div>
          )}

        </main>

        <Drawer data={drawer} saves={saves} writesOn={writes.ok && !stale} writesReason={stale ? "Memory unavailable, saving is off." : writes.reason} session={session} ownLabel={usingOwn ? own!.accountId : undefined} onStartOver={newSession} editing={editing} setEditing={setEditing}
          onChange={(m, v) => save(m, v, true)} open={sheet} onClose={() => setSheet(false)} pulse={pulse} loading={drawerLoading} />
      </div>

      <div className="dock" data-dock>
        <span className="small"><b className="num">{drawer?.rules.length ?? 0}</b> {drawer?.rules.length === 1 ? "rule" : "rules"} in your memory</span>
        <button type="button" className="btn" aria-expanded={sheet} aria-controls="memory-drawer" onClick={() => setSheet(!sheet)}><IconDrawer /> Memory drawer</button>
      </div>

      <Trust />
      <Toast text={toast} />
      <Palette open={palette} onClose={() => setPalette(false)} commands={commands} />
    </>
  );
}
