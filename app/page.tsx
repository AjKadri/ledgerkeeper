"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ADDRESS_RE, DEMO_WALLET, IMPORT_SPLIT } from "@/lib/config";
import { friendly } from "@/lib/answers";
import { fly } from "@/lib/fly";
import { dates, prefersReducedMotion, short, usd as usdFmt } from "@/lib/format";
import { Header, Palette, Section, Toast, Trust, type Command } from "@/components/Chrome";
import { Drawer, rangeText } from "@/components/Drawer";
import { Ledger, Skeleton } from "@/components/Ledger";
import { AnsweredCard, QuestionCard } from "@/components/QuestionCard";
import { IconDrawer, Segmented } from "@/components/ui";
import { toDrawer, type DrawerData, type FromMemory, type Question, type RawRules, type Row, type SaveState } from "@/components/types";

type Counts = { asked: number; repeat: number; new: number };
type ImportResult = {
  address: string; from?: string; to?: string; txCount: number; source: string; cachedAt?: string; note?: string; memory: boolean;
  labelCounts: Record<string, number>; questions: Question[]; counts: { on: Counts; off: Counts }; reused: number;
  previousOutcome: { range: string; asked: number; answered: number; blob: string } | null;
  updates: { match: string; from: string; to: string }[];
  usd: { basis: string; priced: number; of: number; received: number; sent: number };
  answeredFromMemory: FromMemory[]; rows: Row[]; drawer: RawRules;
  writes: { ok: boolean; reason?: string };
  memoryStats: { rules: number; outcomes: number; listed: number; incomplete: boolean };
};

const rand = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function checkAddress(v: string): { ok: boolean; text: string } {
  if (!v) return { ok: false, text: "Paste a Sui address: 0x followed by 64 characters." };
  if (!v.startsWith("0x")) return { ok: false, text: "A Sui address starts with 0x." };
  if (!/^0x[0-9a-fA-F]*$/.test(v)) return { ok: false, text: "After 0x only the characters 0–9 and a–f are allowed." };
  if (v.length < 66) return { ok: false, text: `Keep going: ${v.length} of 66 characters.` };
  if (v.length > 66) return { ok: false, text: `Too long: ${v.length} characters, a Sui address has 66.` };
  return { ok: ADDRESS_RE.test(v), text: "Valid Sui address" };
}

export default function Home() {
  const [session, setSession] = useState("");
  const [address, setAddress] = useState("");
  const [memory, setMemory] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [res, setRes] = useState<ImportResult | null>(null);
  const [which, setWhich] = useState("");
  const [saves, setSaves] = useState<Record<string, SaveState>>({});
  const [pick, setPick] = useState<Record<string, string>>({});
  const [drawer, setDrawer] = useState<DrawerData | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(true);
  const [writes, setWrites] = useState<{ ok: boolean; reason?: string }>({ ok: true });
  const [outcome, setOutcome] = useState<"saving" | "saved" | "error" | null>(null);
  const [toast, setToast] = useState("");
  const [palette, setPalette] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [pulse, setPulse] = useState<string[]>([]);
  const [seq, setSeq] = useState<"idle" | "running" | "done">("idle");
  const [shownRepeat, setShownRepeat] = useState(0);

  const inflight = useRef(new Set<string>());
  const outcomeFor = useRef<ImportResult | null>(null);
  const savesRef = useRef(saves); savesRef.current = saves;
  const drawerRef = useRef(drawer); drawerRef.current = drawer;
  const sessionRef = useRef(session); sessionRef.current = session;
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
    fetch("/api/status").then((r) => r.json()).then((j) => setWrites({ ok: j.writesEnabled, reason: j.reason ?? undefined })).catch(() => {});
  }, []);

  const refreshDrawer = useCallback(async (ns = sessionRef.current): Promise<DrawerData | null> => {
    if (!ns) return null;
    try {
      const r = await fetch(`/api/rules?as=A&namespace=${ns}`);
      const j = await r.json();
      if (r.ok) { const d = toDrawer(j); setDrawer(d); return d; }
    } catch { /* keep what is shown */ } finally { setDrawerLoading(false); }
    return null;
  }, []);
  useEffect(() => { if (session) refreshDrawer(session); }, [session, refreshDrawer]);

  function newSession() {
    const s = "lk-" + rand(8);
    try { localStorage.setItem("lk-session", s); } catch { /* storage blocked */ }
    setSession(s); setRes(null); setSaves({}); setPick({}); setDrawer(null); setOutcome(null); setError(""); setEditing(null);
    outcomeFor.current = null; lastRun.current = null; setDrawerLoading(true);
    say("New session started. Your memory drawer is empty.");
  }

  // ---------- import ----------
  async function run(name: string, range: { from?: string; to?: string }, o?: { memory?: boolean; addr?: string }) {
    const addr = o?.addr ?? address, mem = o?.memory ?? memory;
    setBusy(true); setError(""); setWhich(name); lastRun.current = { name, range, addr };
    try {
      const resp = await fetch("/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: addr, namespace: session, memory: mem, ...range }) });
      const j: ImportResult = await resp.json();
      if (!resp.ok) throw new Error((j as unknown as { error: string }).error);
      setSaves({}); setPick({}); setOutcome(null); setEditing(null); outcomeFor.current = null;
      setWrites(j.writes); setDrawer(toDrawer(j.drawer)); setDrawerLoading(false);
      setRes(j);
    } catch (e) { setError((e as Error).message); setRes(null); } finally { setBusy(false); }
  }
  const runSample = () => { setAddress(DEMO_WALLET); run("Import 1 (to 30 Jun)", { to: IMPORT_SPLIT.import1.to }, { addr: DEMO_WALLET }); };

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
      const r = await fetch("/api/answer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ namespace: session, match, value, answerId }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      let done = false;
      for (let i = 0; i < 90 && !done; i++) {
        await sleep(2000);
        try {
          const s = await (await fetch(`/api/job?namespace=${session}&id=${encodeURIComponent(j.jobId)}`)).json();
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
    setOutcome("saving");
    try {
      const rg = `${r.from ?? "start"}..${r.to ?? "now"}`;
      const resp = await fetch("/api/outcome", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        namespace: session, address: r.address, range: rg, txs: r.txCount, asked: r.counts.on.asked, answered, reused: r.reused, outcomeId: rand(8) }) });
      const j = await resp.json(); if (!resp.ok) throw new Error(j.error);
      for (let i = 0; i < 60; i++) {
        await sleep(2000);
        const s = await (await fetch(`/api/job?namespace=${session}&id=${encodeURIComponent(j.jobId)}`)).json();
        if (s.status === "done") { setOutcome("saved"); await refreshDrawer(); say("Import outcome saved to your memory"); return; }
        if (s.status === "failed" || s.status === "not_found") break;
      }
      setOutcome("error");
    } catch { setOutcome("error"); }
  }, [session, refreshDrawer, say]);

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
  const readOnly = !writes.ok;
  const incomplete = !!res?.memoryStats.incomplete || !!drawer?.incomplete;
  const canSave = writes.ok && !incomplete;
  const exportHref = res ? `/api/export?as=A&address=${res.address}&namespace=${session}` : "#";
  const accountantHref = res ? `/accountant?address=${res.address}&ns=${session}` : "#";
  const questions = res?.questions ?? [];
  const showFm = !!res && res.memory && res.answeredFromMemory.length > 0;
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

  const commands: Command[] = useMemo(() => [
    { id: "sample", title: "Import the sample wallet", run: runSample },
    { id: "imp1", title: "Import 1: up to 30 Jun", run: () => runFor("Import 1 (to 30 Jun)", { to: IMPORT_SPLIT.import1.to }) },
    { id: "imp2", title: "Import 2: Jul–Aug", run: () => runFor("Import 2 (Jul–Aug)", IMPORT_SPLIT.import2) },
    { id: "impall", title: "Import all history", run: () => runFor("Import all", {}) },
    { id: "new", title: "Start a new session", run: newSession },
    { id: "export", title: "Export CSV", run: () => { if (res) window.location.href = exportHref; else say("Import a wallet first."); } },
    { id: "acct", title: "Open the accountant view", run: () => { if (res) window.open(accountantHref, "_blank"); else say("Import a wallet first."); } },
    { id: "memory", title: memory ? "Turn memory off for this import" : "Turn memory on for this import", run: () => switchMemory(memory ? "off" : "on") },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [res, memory, exportHref, accountantHref, session, address]);

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

  const rangeButtons = (
    <div className="rangebar" role="group" aria-label="Choose what to import">
      <button type="button" className="btn" disabled={busy || !addr.ok || !session} onClick={() => run("Import 1 (to 30 Jun)", { to: IMPORT_SPLIT.import1.to })}>Import 1: up to 30 Jun</button>
      <button type="button" className="btn" disabled={busy || !addr.ok || !session} onClick={() => run("Import 2 (Jul–Aug)", IMPORT_SPLIT.import2)}>Import 2: Jul–Aug</button>
      <button type="button" className="btn" disabled={busy || !addr.ok || !session} onClick={() => run("Import all", {})}>Import all</button>
    </div>
  );

  const field = (big: boolean) => (
    <div>
      <label htmlFor="addr" className={big ? "sr-only" : "small muted"}>Sui address</label>
      <input id="addr" className="field" value={address} spellCheck={false} autoComplete="off" autoCapitalize="off" placeholder="0x…" aria-describedby="addr-hint"
        aria-invalid={!!address && !addr.ok && address.length >= 66 ? true : undefined}
        onChange={(e) => setAddress(e.target.value.trim())} onKeyDown={(e) => { if (e.key === "Enter" && addr.ok && !busy) run("Import all", {}); }} />
      <p id="addr-hint" className={`hint${!big && addr.ok ? " sr-only" : ""} ${addr.ok ? "hint--ok" : address && (/[^0-9a-fx]/i.test(address.slice(1)) || address.length > 66) ? "hint--bad" : ""}`} aria-live="polite">{addr.text}</p>
    </div>
  );

  const started = !!res || busy || !!error;

  return (
    <>
      <Header wallet={res?.address} onPalette={() => setPalette(true)} />
      <div className="shell layout">
        <main className="main" aria-busy={busy}>
          {readOnly && (
            <div className="banner banner--warn" role="status">
              <b>Read-only mode.</b> {writes.reason ?? "Memory writes are switched off."} Rules already saved are still applied and the export works, but new answers cannot be saved right now.
            </div>
          )}

          {!started && (
            <section className="hero">
              <h1>Label your Sui history for your accountant. Answer each question once.</h1>
              <p className="lead">Your answers are filed as rules in your Walrus Memory, so the next import, and any app you allow, starts from what you already told it.</p>
              <div className="hero__form">
                {field(true)}
                <div className="hero__actions">
                  <button type="button" className="btn btn--primary" disabled={!addr.ok || busy || !session} onClick={() => run("Import all", {})}>Import history</button>
                  <button type="button" className="btn" disabled={busy || !session} onClick={runSample}>Try the sample wallet</button>
                  <span className="small muted">Sample: a public wallet, fictional owner.</span>
                </div>
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
              {rangeButtons}
              {error && (
                <div className="banner banner--bad" role="alert" style={{ marginTop: 16, marginBottom: 0 }}>
                  <b>Could not import.</b> {error} <button type="button" className="btn btn--quiet" style={{ minHeight: 32 }} onClick={runSample}>Try the sample wallet</button>
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
              <Section>
                <p className="result__meta">
                  {which}: <span className="num">{res.txCount}</span> transactions ({res.source === "cached" ? `cached at ${res.cachedAt}` : "live from Tatum"}){res.note ? ` · ${res.note}` : ""}
                  {outcome && <> · import outcome {outcome === "saving" ? "saving…" : outcome === "saved" ? "saved" : "not saved"}</>}
                </p>
                <h1 className="big" aria-live="polite"><span className="num">{bigRepeat}</span> repeat question{bigRepeat === 1 ? "" : "s"}</h1>
                <p className="big__sub">
                  {res.memory
                    ? <><b className="num">{res.counts.off.repeat}</b> answered from memory · <b className="num">{c.on.new}</b> new</>
                    : <><b className="num">{res.counts.off.repeat}</b> would be asked again · <b className="num">{c.off.new}</b> new</>}
                </p>
                <p className="small muted" style={{ marginTop: 4 }}>Repeat questions: <span className="num">{c.on.repeat}</span> with memory / <span className="num">{c.off.repeat}</span> without</p>

                {res.previousOutcome ? (
                  <p className="last">
                    Last time ({rangeText(res.previousOutcome.range)}) you answered <b className="num">{res.previousOutcome.answered}</b> of <span className="num">{res.previousOutcome.asked}</span> questions.
                    This time: <b className="num">{c.on.new}</b> new question{c.on.new === 1 ? "" : "s"}, <b className="num">{res.reused}</b> reused from memory.{" "}
                    <span className="small muted">From your import outcome memory.</span>
                  </p>
                ) : <p className="small muted" style={{ marginTop: 16 }}>No earlier import is recorded in this memory yet.</p>}

                <div className="compare">
                  <Segmented label="Memory for this import" value={memory ? "on" : "off"} onChange={switchMemory} disabled={busy}
                    options={[{ value: "on", text: "Memory on" }, { value: "off", text: "Memory off" }]} />
                  <div className="compare__col compare__col--on"><div className="k">With memory</div><div className="v num">{c.on.asked} asked</div><div className="d num">{c.on.repeat} repeat · {c.on.new} new</div></div>
                  <div className="compare__col"><div className="k">Without memory</div><div className="v num">{c.off.asked} asked</div><div className="d num">{c.off.repeat} repeat · {c.off.new} new</div></div>
                </div>

                {res.updates.map((u) => (
                  <p key={u.match} className="small wrap" style={{ marginTop: 12, color: "var(--green)" }}>
                    Updated from {friendly(u.from, u.match)} to {friendly(u.to, u.match)}: <span className="mono">{short(u.match)}</span>. The newest answer wins.
                  </p>
                ))}
                {res.usd.priced > 0 && (
                  <p className="usd">
                    <b>USD value of SUI legs</b> (approximate, on-chain pool price): received <b className="num">{usdFmt(res.usd.received)}</b>, sent <b className="num">{usdFmt(Math.abs(res.usd.sent))}</b> across <span className="num">{res.usd.priced}</span> of <span className="num">{res.usd.of}</span> transactions. Other coins (for example CETUS) are not valued.
                  </p>
                )}
                {incomplete && <div className="banner banner--bad" role="alert" style={{ marginTop: 16 }}><b>Memory returned fewer items than it holds.</b> Some saved answers may be missing, so saving is paused. Run the import again before answering.</div>}
              </Section>

              <Section title="Questions" note={questions.length > 0 ? <>J and K move between cards · <kbd>1</kbd>–<kbd>4</kbd> choose · <kbd>Enter</kbd> saves</> : undefined}>
                <div className="qlist">
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

              <Section title="Transactions" note={`${res.rows.length} rows, ${dates(res.rows[0]?.date.slice(0, 10) ?? "", res.rows[res.rows.length - 1]?.date.slice(0, 10) ?? "")}`}>
                <Ledger rows={res.rows} onJumpRule={jumpToRule} exportHref={exportHref} app="A" />
                <p className="small muted no-print" style={{ marginTop: 16 }}>
                  Sending this to your accountant? <a href={accountantHref} target="_blank" rel="noreferrer">Open the accountant view</a>, a separate app that reads the same rules with its own key.
                </p>
              </Section>
            </div>
          )}

        </main>

        <Drawer data={drawer} saves={saves} writesOn={writes.ok} writesReason={writes.reason} session={session} editing={editing} setEditing={setEditing}
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
