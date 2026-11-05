"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ANSWER_LABELS, DEMO_WALLET, IMPORT_SPLIT } from "@/lib/config";

type Question = { key: string; count: number; question: string; repeat: boolean; samples: { digest: string; date: string; detail: string }[] };
type Counts = { asked: number; repeat: number; new: number };
type ImportResult = {
  address: string; from?: string; to?: string; txCount: number; source: string; cachedAt?: string; note?: string; memory: boolean;
  labelCounts: Record<string, number>; questions: Question[]; counts: { on: Counts; off: Counts }; reused: number;
  previousOutcome: { range: string; txs: number; asked: number; answered: number; reused: number; blob: string } | null;
  updates: { match: string; from: string; to: string }[];
  memoryStats: { rules: number; outcomes: number; listed: number; incomplete: boolean };
};
type Save = { state: "saving" | "saved" | "error"; blob?: string; error?: string; label: string; answerId: string };
type StoredRules = { rules: { match: string; label: string }[]; blobs: Record<string, string>; updates: { match: string; from: string; to: string }[]; listed: number };

const rand = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
const box = { border: "1px solid #ccc", borderRadius: 6, padding: 12, margin: "12px 0" } as const;
const th = { textAlign: "left", paddingRight: 24 } as const;
const blobLink = (b?: string) => <a href={`https://walruscan.com/mainnet/blob/${b}`} target="_blank" rel="noreferrer">blob {b?.slice(0, 10)}…</a>;

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
  const [stored, setStored] = useState<StoredRules | null>(null);
  const [outcome, setOutcome] = useState<{ state: "saving" | "saved" | "error"; blob?: string } | null>(null);
  const inflight = useRef(new Set<string>());
  const outcomeFor = useRef<ImportResult | null>(null);
  const range = useRef<{ from?: string; to?: string }>({});

  useEffect(() => {
    let s = "";
    try { s = localStorage.getItem("lk-session") ?? ""; } catch {}
    if (!/^lk-[a-f0-9]{16}$/.test(s)) { s = "lk-" + rand(8); try { localStorage.setItem("lk-session", s); } catch {} }
    setSession(s);
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
    setBusy(true); setError(""); setWhich(name); range.current = r;
    try {
      const resp = await fetch("/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address, namespace: session, memory, ...r }) });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.error);
      setRes(j); setSaves({}); setOutcome(null); outcomeFor.current = null; refreshRules();
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

  async function save(match: string, label: string) {
    if (inflight.current.has(match)) return; // double click guard
    inflight.current.add(match);
    // A retry after an error reuses the same answer id (no duplicate); a new click is a new answer (corrections win by newest).
    const prev = saves[match];
    const answerId = prev?.state === "error" && prev.label === label ? prev.answerId : rand(8);
    setSaves((s) => ({ ...s, [match]: { state: "saving", label, answerId } }));
    try {
      const r = await fetch("/api/answer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ namespace: session, match, label, answerId }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await poll(j.jobId,
        (blob) => { setSaves((s) => ({ ...s, [match]: { state: "saved", blob, label, answerId } })); refreshRules(); },
        () => setSaves((s) => ({ ...s, [match]: { state: "error", error: "Not saved. Retry.", label, answerId } })));
    } catch (e) { setSaves((s) => ({ ...s, [match]: { state: "error", error: (e as Error).message, label, answerId } })); }
    finally { inflight.current.delete(match); }
  }

  // Outcome memory: written once an import has no unanswered questions left.
  const recordOutcome = useCallback(async (r: ImportResult, answered: number) => {
    if (outcomeFor.current === r) return;
    outcomeFor.current = r;
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
  const accountant = `/accountant?address=${address}&ns=${session}`;

  return (
    <main>
      <div style={box}>
        <b>Sample: public wallet, fictional owner (&ldquo;Sam&rdquo;).</b> You can paste any Sui address (read-only, live via Tatum). Memory namespace: <code>{session}</code>{" "}
        <button onClick={reset}>New session</button>
        <div style={{ marginTop: 8 }}>
          <input value={address} onChange={(e) => setAddress(e.target.value.trim())} style={{ width: "100%", fontFamily: "monospace" }} aria-label="Sui address" />
        </div>
        <label style={{ display: "block", margin: "8px 0" }}>
          <input type="checkbox" checked={memory} onChange={(e) => setMemory(e.target.checked)} /> Use saved memory (decides which questions you answer; both counts are always shown)
        </label>
        <button disabled={busy || !session} onClick={() => run("Import 1 (to 30 Jun)", { to: IMPORT_SPLIT.import1.to })}>Import 1: up to 30 Jun</button>{" "}
        <button disabled={busy || !session} onClick={() => run("Import 2 (Jul–Aug)", IMPORT_SPLIT.import2)}>Import 2: Jul–Aug</button>{" "}
        <button disabled={busy || !session} onClick={() => run("Import all", {})}>Import all</button>
        {busy && <span> working…</span>}
        {error && <p style={{ color: "#b00" }}>{error}</p>}
      </div>

      {res && c && (
        <div style={box}>
          <b>{which}</b>: {res.txCount} transactions ({res.source === "cached" ? `cached at ${res.cachedAt}` : "live from Tatum"}){res.note && <em> — {res.note}</em>}
          <div style={{ fontSize: 13 }}>Labels: {Object.entries(res.labelCounts).map(([k, v]) => `${k} ${v}`).join(", ")}</div>
          <h3 style={{ margin: "12px 0 4px" }}>Repeat questions: {c.on.repeat} with memory / {c.off.repeat} without</h3>
          <div>New questions (never seen before): <b>{c.on.new}</b></div>
          {res.previousOutcome ? (
            <p style={{ background: "#f3f8ff", padding: 8 }}>
              Last time ({res.previousOutcome.range}) you answered <b>{res.previousOutcome.answered}</b> of {res.previousOutcome.asked} questions.
              This time: <b>{c.on.new}</b> new question{c.on.new === 1 ? "" : "s"}, <b>{res.reused}</b> reused from memory.{" "}
              <small>(from the outcome memory, {blobLink(res.previousOutcome.blob)})</small>
            </p>
          ) : <p style={{ color: "#666" }}>No earlier import recorded in this memory yet.</p>}
          {res.updates.map((u) => <p key={u.match} style={{ color: "#070" }}>Updated: <code>{u.match.slice(0, 12)}…</code> from {u.from} to {u.to} (newest answer wins).</p>)}
          <table style={{ marginTop: 8 }}>
            <thead><tr><th style={th}></th><th style={th}>Memory ON</th><th style={th}>Memory OFF</th></tr></thead>
            <tbody>
              <tr><td style={th}>Questions asked</td><td style={th}><b>{c.on.asked}</b></td><td style={th}><b>{c.off.asked}</b></td></tr>
              <tr><td style={th}>of which repeat</td><td style={th}>{c.on.repeat}</td><td style={th}>{c.off.repeat}</td></tr>
              <tr><td style={th}>of which new</td><td style={th}>{c.on.new}</td><td style={th}>{c.off.new}</td></tr>
            </tbody>
          </table>
          <div style={{ fontSize: 13, color: "#555" }}>Showing the questions for memory {res.memory ? "ON" : "OFF"}. Memory holds {res.memoryStats.listed} memories ({res.memoryStats.rules} rules, {res.memoryStats.outcomes} import outcomes).</div>
          {res.memoryStats.incomplete && <p style={{ color: "#b60" }}>Memory returned fewer items than it holds. Re-run the import before answering.</p>}
          {outcome && <div style={{ fontSize: 13 }}>Import outcome: {outcome.state === "saving" ? "saving… (about 20 s)" : outcome.state === "saved" ? <>saved, {blobLink(outcome.blob)}</> : "not saved"}</div>}
        </div>
      )}

      {q.length > 0 && (
        <div style={box}>
          <b>Questions</b>
          {q.map((x) => {
            const s = saves[x.key];
            const label = pick[x.key] ?? ANSWER_LABELS[0];
            return (
              <div key={x.key} style={{ borderTop: "1px solid #eee", padding: "8px 0" }}>
                <span style={{ fontSize: 12, padding: "1px 6px", borderRadius: 8, background: x.repeat ? "#fde8c8" : "#d8f0d8" }}>{x.repeat ? "repeat" : "new"}</span> {x.question}
                <div style={{ fontSize: 13 }}>
                  {x.samples.map((m) => <a key={m.digest} href={`https://suiscan.xyz/mainnet/tx/${m.digest}`} target="_blank" rel="noreferrer" style={{ marginRight: 8 }}>{m.date}</a>)}
                </div>
                <select value={label} disabled={s?.state === "saving"} onChange={(e) => setPick({ ...pick, [x.key]: e.target.value })}>
                  {ANSWER_LABELS.map((l) => <option key={l}>{l}</option>)}
                </select>{" "}
                <button disabled={s?.state === "saving"} onClick={() => save(x.key, label)}>{s?.state === "saved" ? "Save again" : "Save answer"}</button>{" "}
                {s?.state === "saving" && <span>saving… (takes about 20 s)</span>}
                {s?.state === "saved" && <span style={{ color: "#070" }}>saved as {s.label}: {blobLink(s.blob)}</span>}
                {s?.state === "error" && <span style={{ color: "#b00" }}>{s.error}</span>}
              </div>
            );
          })}
        </div>
      )}

      {stored && stored.rules.length > 0 && (
        <div style={box}>
          <b>Your saved rules</b> <small>({stored.listed} memories in this namespace). Change one and the newest answer wins on the next import.</small>
          {stored.rules.map((r) => {
            const s = saves[r.match];
            const label = pick["rule:" + r.match] ?? r.label;
            const upd = stored.updates.find((u) => u.match === r.match);
            return (
              <div key={r.match} style={{ borderTop: "1px solid #eee", padding: "6px 0", fontSize: 14 }}>
                <code>{r.match.length > 24 ? r.match.slice(0, 14) + "…" + r.match.slice(-6) : r.match}</code>{" "}
                <select value={label} disabled={s?.state === "saving"} onChange={(e) => setPick({ ...pick, ["rule:" + r.match]: e.target.value })}>
                  {ANSWER_LABELS.map((l) => <option key={l}>{l}</option>)}
                </select>{" "}
                <button disabled={s?.state === "saving" || label === r.label} onClick={() => save(r.match, label)}>Update</button>{" "}
                {s?.state === "saving" && <span>saving… (about 20 s)</span>}
                {s?.state === "saved" && <span style={{ color: "#070" }}>updated to {s.label}: {blobLink(s.blob)}</span>}
                {s?.state === "error" && <span style={{ color: "#b00" }}>{s.error}</span>}
                {upd && !s && <span style={{ color: "#070" }}> updated from {upd.from} to {upd.to}</span>}
              </div>
            );
          })}
        </div>
      )}

      <div style={box}>
        <a href={`/api/export?as=A&address=${address}&namespace=${session}`}>Download CSV (app A)</a> ·{" "}
        <a href={accountant} target="_blank" rel="noreferrer">Open the Accountant view (app B)</a>
      </div>
    </main>
  );
}
