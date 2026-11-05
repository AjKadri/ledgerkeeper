"use client";
import { useEffect, useRef, useState } from "react";
import { ANSWER_LABELS, DEMO_WALLET, IMPORT_SPLIT } from "@/lib/config";

type Question = { key: string; count: number; question: string; samples: { digest: string; date: string; detail: string }[] };
type ImportResult = {
  txCount: number; source: string; cachedAt?: string; note?: string; memory: boolean; labelCounts: Record<string, number>;
  questions: Question[]; questionsWithoutMemory: number;
  rulesRecalled: { count: number; listed: number; incomplete: boolean; conflicts: { match: string; labels: string[] }[] } | null;
};
type Save = { state: "idle" | "saving" | "saved" | "error"; blob?: string; error?: string; label: string };

const newSession = () => "lk-" + Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
const box = { border: "1px solid #ccc", borderRadius: 6, padding: 12, margin: "12px 0" } as const;

export default function Home() {
  const [session, setSession] = useState("");
  const [address, setAddress] = useState(DEMO_WALLET);
  const [memory, setMemory] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [res, setRes] = useState<ImportResult | null>(null);
  const [which, setWhich] = useState("");
  const [history, setHistory] = useState<{ name: string; asked: number; without: number; memory: boolean }[]>([]);
  const [saves, setSaves] = useState<Record<string, Save>>({});
  const inflight = useRef(new Set<string>());

  useEffect(() => {
    let s = "";
    try { s = localStorage.getItem("lk-session") ?? ""; } catch {}
    if (!/^lk-[a-f0-9]{16}$/.test(s)) { s = newSession(); try { localStorage.setItem("lk-session", s); } catch {} }
    setSession(s);
  }, []);

  function reset() {
    const s = newSession(); try { localStorage.setItem("lk-session", s); } catch {}
    setSession(s); setRes(null); setHistory([]); setSaves({}); setError("");
  }

  async function run(name: string, range: { from?: string; to?: string }) {
    setBusy(true); setError(""); setWhich(name);
    try {
      const r = await fetch("/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address, namespace: session, memory, ...range }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setRes(j); setSaves({});
      setHistory((h) => [...h, { name, asked: j.questions.length, without: j.questionsWithoutMemory, memory }]);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function poll(k: string, jobId: string, label: string) {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const j = await (await fetch(`/api/job?namespace=${session}&id=${encodeURIComponent(jobId)}`)).json();
        if (j.status === "done") { setSaves((s) => ({ ...s, [k]: { state: "saved", blob: j.blob_id, label } })); return; }
        if (j.status === "failed" || j.status === "not_found") break;
      } catch {}
    }
    setSaves((s) => ({ ...s, [k]: { state: "error", error: "Not saved. Retry.", label } }));
  }

  async function save(q: Question, label: string) {
    if (inflight.current.has(q.key)) return; // double click guard
    inflight.current.add(q.key);
    setSaves((s) => ({ ...s, [q.key]: { state: "saving", label } }));
    try {
      const r = await fetch("/api/answer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ namespace: session, match: q.key, label }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await poll(q.key, j.jobId, label);
    } catch (e) { setSaves((s) => ({ ...s, [q.key]: { state: "error", error: (e as Error).message, label } })); }
    finally { inflight.current.delete(q.key); }
  }

  const [pick, setPick] = useState<Record<string, string>>({});
  const q = res?.questions ?? [];
  const accountant = `/accountant?address=${address}&ns=${session}`;

  return (
    <main>
      <div style={box}>
        <b>Sample: public wallet, fictional owner (&ldquo;Sam&rdquo;).</b> Session memory namespace: <code>{session}</code>{" "}
        <button onClick={reset}>New session</button>
        <div style={{ marginTop: 8 }}>
          <input value={address} onChange={(e) => setAddress(e.target.value.trim())} style={{ width: "100%", fontFamily: "monospace" }} aria-label="Sui address" />
        </div>
        <label style={{ display: "block", margin: "8px 0" }}>
          <input type="checkbox" checked={memory} onChange={(e) => setMemory(e.target.checked)} /> Use saved memory (recalled rules)
        </label>
        <button disabled={busy || !session} onClick={() => run("Import 1 (to 30 Jun)", { to: IMPORT_SPLIT.import1.to })}>Import 1: up to 30 Jun</button>{" "}
        <button disabled={busy || !session} onClick={() => run("Import 2 (Jul–Aug)", IMPORT_SPLIT.import2)}>Import 2: Jul–Aug</button>{" "}
        <button disabled={busy || !session} onClick={() => run("Import all", {})}>Import all</button>
        {busy && <span> working…</span>}
        {error && <p style={{ color: "#b00" }}>{error}</p>}
      </div>

      {res && (
        <div style={box}>
          <b>{which}</b>: {res.txCount} transactions ({res.source === "cached" ? `cached at ${res.cachedAt}` : "live from Tatum"}){res.note && <em> — {res.note}</em>}
          <div>Labels: {Object.entries(res.labelCounts).map(([k, v]) => `${k} ${v}`).join(", ")}</div>
          <div>
            Questions: <b>{res.questions.length}</b> with memory {res.memory ? "ON" : "OFF"}
            {res.rulesRecalled && <> ({res.rulesRecalled.count} rules recalled, {res.rulesRecalled.listed} in memory)</>}
            {" "}· without memory: <b>{res.questionsWithoutMemory}</b>
          </div>
          {res.rulesRecalled?.incomplete && <p style={{ color: "#b60" }}>Memory returned fewer rules than it holds. Re-run the import before answering.</p>}
          {res.rulesRecalled?.conflicts.map((c) => <p key={c.match} style={{ color: "#555" }}>Conflict for {c.match.slice(0, 10)}…: newest rule wins.</p>)}
        </div>
      )}

      {q.length > 0 && (
        <div style={box}>
          <b>Questions</b>
          {q.map((x) => {
            const s = saves[x.key] ?? { state: "idle", label: "" };
            const label = pick[x.key] ?? ANSWER_LABELS[0];
            return (
              <div key={x.key} style={{ borderTop: "1px solid #eee", padding: "8px 0" }}>
                <div>{x.question}</div>
                <div style={{ fontSize: 13 }}>
                  {x.samples.map((m) => <a key={m.digest} href={`https://suiscan.xyz/mainnet/tx/${m.digest}`} target="_blank" rel="noreferrer" style={{ marginRight: 8 }}>{m.date}</a>)}
                </div>
                <select value={label} disabled={s.state === "saving"} onChange={(e) => setPick({ ...pick, [x.key]: e.target.value })}>
                  {ANSWER_LABELS.map((l) => <option key={l}>{l}</option>)}
                </select>{" "}
                <button disabled={s.state === "saving"} onClick={() => save(x, label)}>{s.state === "saved" ? "Save again" : "Save answer"}</button>{" "}
                {s.state === "saving" && <span>saving… (takes about 20 s)</span>}
                {s.state === "saved" && <span style={{ color: "#070" }}>saved as {s.label}: <a href={`https://walruscan.com/mainnet/blob/${s.blob}`} target="_blank" rel="noreferrer">blob {s.blob?.slice(0, 10)}…</a></span>}
                {s.state === "error" && <span style={{ color: "#b00" }}>{s.error}</span>}
              </div>
            );
          })}
        </div>
      )}

      {history.length > 0 && (
        <div style={box}>
          <b>Question counts this session</b>
          <table><tbody>{history.map((h, i) => <tr key={i}><td style={{ paddingRight: 12 }}>{h.name}</td><td>memory {h.memory ? "ON" : "OFF"}: asked {h.asked}</td><td style={{ paddingLeft: 12 }}>(without memory: {h.without})</td></tr>)}</tbody></table>
        </div>
      )}

      <div style={box}>
        <a href={`/api/export?as=A&address=${address}&namespace=${session}`}>Download CSV (app A)</a> ·{" "}
        <a href={accountant} target="_blank" rel="noreferrer">Open the Accountant view (app B)</a>
      </div>
    </main>
  );
}
