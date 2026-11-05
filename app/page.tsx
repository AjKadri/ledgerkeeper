"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_WALLET, IMPORT_SPLIT } from "@/lib/config";
import { friendly, optionsFor, isContractKey } from "@/lib/answers";

type Question = { key: string; count: number; question: string; repeat: boolean; in: number; out: number; first: string; last: string; samples: { digest: string; date: string }[] };
type Counts = { asked: number; repeat: number; new: number };
type ImportResult = {
  address: string; from?: string; to?: string; txCount: number; source: string; cachedAt?: string; note?: string; memory: boolean;
  labelCounts: Record<string, number>; questions: Question[]; counts: { on: Counts; off: Counts }; reused: number;
  previousOutcome: { range: string; asked: number; answered: number; blob: string } | null;
  updates: { match: string; from: string; to: string }[];
  usd: { basis: string; priced: number; of: number; received: number; sent: number; top: { date: string; digest: string; label: string; price: string; usd: string }[] };
  writes: { ok: boolean; reason?: string };
  memoryStats: { rules: number; outcomes: number; listed: number; incomplete: boolean };
};
// `prev` is the stored answer before this save, so we can say "saved" the first time and "updated from A to B" only on a change.
type Save = { state: "saving" | "saved" | "error"; blob?: string; error?: string; value: string; answerId: string; prev?: string };
type Stored = { rules: { match: string; label?: string; kind?: string }[]; updates: { match: string; from: string; to: string }[]; listed: number };

const rand = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
const valueOf = (r: { label?: string; kind?: string }) => (r.kind ? `kind:${r.kind}` : `label:${r.label}`);
const short = (k: string) => (k.length > 24 ? k.slice(0, 12) + "…" + k.slice(-6) : k);
const day = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const dates = (a: string, b: string) => (a === b ? day(a) : `${day(a)} – ${day(b)}`);
const blobLink = (b?: string) => <a href={`https://walruscan.com/mainnet/blob/${b}`} target="_blank" rel="noreferrer">blob {b?.slice(0, 10)}…</a>;
const th = { textAlign: "left", paddingRight: 20 } as const;

function saveNote(s: Save, key: string) {
  if (s.state === "saving") return <span>saving… (about 20 s)</span>;
  if (s.state === "error") return <span style={{ color: "#b00" }}>{s.error}</span>;
  const now = friendly(s.value, key);
  const msg = !s.prev ? `saved as ${now}` : s.prev === s.value ? `saved again as ${now}` : `updated from ${friendly(s.prev, key)} to ${now}`;
  return <span style={{ color: "#070" }}>{msg}: {blobLink(s.blob)}</span>;
}

export default function Home() {
  const [session, setSession] = useState("");
  const [address, setAddress] = useState(DEMO_WALLET);
  const [memory, setMemory] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [res, setRes] = useState<ImportResult | null>(null);
  const [which, setWhich] = useState("");
  const [saves, setSaves] = useState<Record<string, Save>>({});
  const [pick, setPick] = useState<Record<string, string>>({});
  const [stored, setStored] = useState<Stored | null>(null);
  const [writes, setWrites] = useState<{ ok: boolean; reason?: string }>({ ok: true });
  const [outcome, setOutcome] = useState<{ state: "saving" | "saved" | "error"; blob?: string } | null>(null);
  const inflight = useRef(new Set<string>());
  const outcomeFor = useRef<ImportResult | null>(null);
  const storedRef = useRef<Stored | null>(null);
  storedRef.current = stored;

  useEffect(() => {
    let s = "";
    try { s = localStorage.getItem("lk-session") ?? ""; } catch {}
    if (!/^lk-[a-f0-9]{16}$/.test(s)) { s = "lk-" + rand(8); try { localStorage.setItem("lk-session", s); } catch {} }
    setSession(s);
    fetch("/api/status").then((r) => r.json()).then((j) => setWrites({ ok: j.writesEnabled, reason: j.reason ?? undefined })).catch(() => {});
  }, []);

  const refreshRules = useCallback(async (ns = session) => {
    if (!ns) return;
    try { const r = await fetch(`/api/rules?as=A&namespace=${ns}`); const j = await r.json(); if (r.ok) setStored(j); } catch {}
  }, [session]);
  useEffect(() => { if (session) refreshRules(session); }, [session, refreshRules]);

  function reset() {
    const s = "lk-" + rand(8); try { localStorage.setItem("lk-session", s); } catch {}
    setSession(s); setRes(null); setSaves({}); setStored(null); setOutcome(null); setError(""); outcomeFor.current = null;
  }

  async function run(name: string, r: { from?: string; to?: string }) {
    setBusy(true); setError(""); setWhich(name);
    try {
      const resp = await fetch("/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address, namespace: session, memory, ...r }) });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.error);
      setRes(j); setWrites(j.writes); setSaves({}); setOutcome(null); outcomeFor.current = null; refreshRules();
    } catch (e) { setError((e as Error).message); setRes(null); } finally { setBusy(false); }
  }

  async function poll(jobId: string, onDone: (blob: string) => void, onFail: () => void) {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const j = await (await fetch(`/api/job?namespace=${session}&id=${encodeURIComponent(jobId)}`)).json();
        if (j.status === "done") return onDone(j.blob_id);
        if (j.status === "failed" || j.status === "not_found") break;
      } catch {}
    }
    onFail();
  }

  async function save(match: string, value: string) {
    if (inflight.current.has(match)) return; // double click guard
    inflight.current.add(match);
    const prevStored = storedRef.current?.rules.find((r) => r.match === match.toLowerCase());
    const prev = prevStored ? valueOf(prevStored) : undefined;
    // A retry after an error reuses the same answer id (no duplicate); a fresh click is a new answer, so a correction wins by newest.
    const old = saves[match];
    const answerId = old?.state === "error" && old.value === value ? old.answerId : rand(8);
    setSaves((s) => ({ ...s, [match]: { state: "saving", value, answerId, prev } }));
    try {
      const r = await fetch("/api/answer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ namespace: session, match, value, answerId }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await poll(j.jobId,
        (blob) => { setSaves((s) => ({ ...s, [match]: { state: "saved", blob, value, answerId, prev } })); refreshRules(); },
        () => setSaves((s) => ({ ...s, [match]: { state: "error", error: "Not saved. Retry.", value, answerId, prev } })));
    } catch (e) { setSaves((s) => ({ ...s, [match]: { state: "error", error: (e as Error).message + " You can retry.", value, answerId, prev } })); }
    finally { inflight.current.delete(match); }
  }

  // Outcome memory: written once an import has no unanswered questions left.
  const recordOutcome = useCallback(async (r: ImportResult, answered: number) => {
    if (outcomeFor.current === r) return;
    outcomeFor.current = r;
    if (!r.writes.ok) return;
    setOutcome({ state: "saving" });
    try {
      const rg = `${r.from ?? "start"}..${r.to ?? "now"}`;
      const resp = await fetch("/api/outcome", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        namespace: session, address: r.address, range: rg, txs: r.txCount, asked: r.counts.on.asked, answered, reused: r.reused, outcomeId: rand(8) }) });
      const j = await resp.json(); if (!resp.ok) throw new Error(j.error);
      await poll(j.jobId, (blob) => { setOutcome({ state: "saved", blob }); refreshRules(); }, () => setOutcome({ state: "error" }));
    } catch { setOutcome({ state: "error" }); }
  }, [session, refreshRules]);

  useEffect(() => {
    if (!res || outcomeFor.current === res) return;
    const qs = res.questions;
    const savedN = qs.filter((q) => saves[q.key]?.state === "saved").length;
    if (qs.length === 0 || savedN === qs.length) recordOutcome(res, savedN);
  }, [res, saves, recordOutcome]);

  const q = res?.questions ?? [];
  const c = res?.counts;
  const incomplete = !!res?.memoryStats.incomplete;
  const canSave = writes.ok && !incomplete;

  return (
    <main>
      {!writes.ok && (
        <div className="box" style={{ background: "#fff4e5", borderColor: "#e0a040" }}>
          <b>Read-only mode.</b> {writes.reason ?? "Memory writes are switched off."} Rules already saved are still applied and the export works, but new answers cannot be saved right now.
        </div>
      )}
      <div className="box">
        <b>Sample: public wallet, fictional owner (&ldquo;Sam&rdquo;).</b> You can paste any Sui address (read-only, live via Tatum). Memory namespace: <code>{session}</code>{" "}
        <button onClick={reset}>New session</button>
        <div style={{ marginTop: 8 }}>
          <input value={address} onChange={(e) => setAddress(e.target.value.trim())} style={{ width: "100%", fontFamily: "monospace", fontSize: 13 }} aria-label="Sui address" />
        </div>
        <label style={{ display: "block", margin: "8px 0" }}>
          <input type="checkbox" checked={memory} onChange={(e) => setMemory(e.target.checked)} /> Use saved memory (decides which questions you answer; both counts are always shown)
        </label>
        <div className="btns">
          <button disabled={busy || !session} onClick={() => run("Import 1 (to 30 Jun)", { to: IMPORT_SPLIT.import1.to })}>Import 1: up to 30 Jun</button>
          <button disabled={busy || !session} onClick={() => run("Import 2 (Jul–Aug)", IMPORT_SPLIT.import2)}>Import 2: Jul–Aug</button>
          <button disabled={busy || !session} onClick={() => run("Import all", {})}>Import all</button>
        </div>
        {busy && <p>working…</p>}
        {error && <p style={{ color: "#b00" }} role="alert">{error}</p>}
      </div>

      {res && c && (
        <div className="box">
          <b>{which}</b>: {res.txCount} transactions ({res.source === "cached" ? `cached at ${res.cachedAt}` : "live from Tatum"}){res.note && <em> — {res.note}</em>}
          <div style={{ fontSize: 13 }} className="wrap">Labels: {Object.entries(res.labelCounts).map(([k, v]) => `${k} ${v}`).join(", ")}</div>
          <h3 style={{ margin: "12px 0 4px" }}>Repeat questions: {c.on.repeat} with memory / {c.off.repeat} without</h3>
          <div>New questions (never seen before): <b>{c.on.new}</b></div>
          {res.previousOutcome ? (
            <p style={{ background: "#f3f8ff", padding: 8 }}>
              Last time ({res.previousOutcome.range}) you answered <b>{res.previousOutcome.answered}</b> of {res.previousOutcome.asked} questions.
              This time: <b>{c.on.new}</b> new question{c.on.new === 1 ? "" : "s"}, <b>{res.reused}</b> reused from memory.{" "}
              <small>(from the outcome memory, {blobLink(res.previousOutcome.blob)})</small>
            </p>
          ) : <p style={{ color: "#666" }}>No earlier import recorded in this memory yet.</p>}
          {res.updates.map((u) => <p key={u.match} style={{ color: "#070" }} className="wrap">Updated: <code>{short(u.match)}</code> from {friendly(u.from, u.match)} to {friendly(u.to, u.match)} (newest answer wins).</p>)}
          <div className="tblwrap">
            <table style={{ marginTop: 8 }}>
              <thead><tr><th style={th}></th><th style={th}>Memory ON</th><th style={th}>Memory OFF</th></tr></thead>
              <tbody>
                <tr><td style={th}>Questions asked</td><td style={th}><b>{c.on.asked}</b></td><td style={th}><b>{c.off.asked}</b></td></tr>
                <tr><td style={th}>of which repeat</td><td style={th}>{c.on.repeat}</td><td style={th}>{c.off.repeat}</td></tr>
                <tr><td style={th}>of which new</td><td style={th}>{c.on.new}</td><td style={th}>{c.off.new}</td></tr>
              </tbody>
            </table>
          </div>
          {res.usd.priced > 0 && (
            <div style={{ marginTop: 10 }}>
              <b>USD value of SUI legs</b> <small>(approximate, on-chain pool price)</small>: received <b>${res.usd.received.toLocaleString("en-US")}</b>, sent <b>${Math.abs(res.usd.sent).toLocaleString("en-US")}</b>
              {" "}across {res.usd.priced} of {res.usd.of} transactions. Other coins (e.g. CETUS) are not valued.
              <div className="tblwrap">
                <table style={{ fontSize: 13, marginTop: 4 }}>
                  <thead><tr><th style={th}>Date</th><th style={th}>Label</th><th style={th}>SUI price</th><th style={th}>USD</th></tr></thead>
                  <tbody>{res.usd.top.map((r) => (
                    <tr key={r.digest}><td style={th}><a href={`https://suiscan.xyz/mainnet/tx/${r.digest}`} target="_blank" rel="noreferrer">{day(r.date)}</a></td><td style={th}>{r.label}</td><td style={th}>${r.price}</td><td style={th}>{Number(r.usd) < 0 ? "-" : ""}${Math.abs(Number(r.usd)).toLocaleString("en-US")}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
          <div style={{ fontSize: 13, color: "#555" }}>Showing the questions for memory {res.memory ? "ON" : "OFF"}. Memory holds {res.memoryStats.listed} memories ({res.memoryStats.rules} rules, {res.memoryStats.outcomes} import outcomes).</div>
          {incomplete && <p style={{ color: "#b60" }} role="alert">Memory returned fewer items than it holds, so some saved answers may be missing. Saving is paused: run the import again before answering.</p>}
          {outcome && <div style={{ fontSize: 13 }}>Import outcome: {outcome.state === "saving" ? "saving… (about 20 s)" : outcome.state === "saved" ? <>saved, {blobLink(outcome.blob)}</> : "not saved"}</div>}
        </div>
      )}

      {q.length > 0 && (
        <div className="box">
          <b>Questions</b>
          {q.map((x) => {
            const s = saves[x.key];
            const value = pick[x.key] ?? "";
            const opts = optionsFor(x.key);
            return (
              <div key={x.key} style={{ borderTop: "1px solid #eee", padding: "8px 0" }}>
                <span style={{ fontSize: 12, padding: "1px 6px", borderRadius: 8, background: x.repeat ? "#fde8c8" : "#d8f0d8" }}>{x.repeat ? "repeat" : "new"}</span>{" "}
                <span className="wrap">{x.question}</span>
                <div style={{ fontSize: 13, color: "#444" }}>
                  {dates(x.first, x.last)}{!isContractKey(x.key) && ` · ${x.out} sent, ${x.in} received`}
                  {" · e.g. "}
                  {x.samples.map((m, i) => <span key={m.digest}>{i > 0 && ", "}<a href={`https://suiscan.xyz/mainnet/tx/${m.digest}`} target="_blank" rel="noreferrer">{day(m.date)} ↗</a></span>)}
                </div>
                <select aria-label={`Answer for ${short(x.key)}`} value={value} disabled={s?.state === "saving"} onChange={(e) => setPick({ ...pick, [x.key]: e.target.value })}>
                  <option value="" disabled>Choose…</option>
                  {opts.map((o) => <option key={o.value} value={o.value}>{o.text}</option>)}
                </select>{" "}
                <button disabled={!value || s?.state === "saving" || !canSave} onClick={() => save(x.key, value)}>{s?.state === "saved" ? "Save again" : "Save answer"}</button>{" "}
                {s && saveNote(s, x.key)}
              </div>
            );
          })}
        </div>
      )}

      {stored && stored.rules.length > 0 && (
        <div className="box">
          <b>Your saved rules</b> <small>({stored.listed} memories in this namespace). Change one and the newest answer wins on the next import.</small>
          {stored.rules.map((r) => {
            const s = saves[r.match];
            const current = valueOf(r);
            const value = pick["rule:" + r.match] ?? current;
            const upd = stored.updates.find((u) => u.match === r.match);
            return (
              <div key={r.match} style={{ borderTop: "1px solid #eee", padding: "6px 0", fontSize: 14 }}>
                <code>{short(r.match)}</code>{" "}
                <select aria-label={`Saved answer for ${short(r.match)}`} value={value} disabled={s?.state === "saving"} onChange={(e) => setPick({ ...pick, ["rule:" + r.match]: e.target.value })}>
                  {optionsFor(r.match).map((o) => <option key={o.value} value={o.value}>{o.text}</option>)}
                  {!optionsFor(r.match).some((o) => o.value === current) && <option value={current}>{friendly(current, r.match)}</option>}
                </select>{" "}
                <button disabled={s?.state === "saving" || value === current || !canSave} onClick={() => save(r.match, value)}>Update</button>{" "}
                {s ? saveNote(s, r.match) : upd && <span style={{ color: "#070" }}>updated from {friendly(upd.from, r.match)} to {friendly(upd.to, r.match)}</span>}
              </div>
            );
          })}
        </div>
      )}

      <div className="box">
        <a href={`/api/export?as=A&address=${address}&namespace=${session}`}>Download CSV (app A)</a> ·{" "}
        <a href={`/accountant?address=${address}&ns=${session}`} target="_blank" rel="noreferrer">Open the Accountant view (app B)</a>
      </div>
    </main>
  );
}
