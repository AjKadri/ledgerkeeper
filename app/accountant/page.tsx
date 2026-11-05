"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function View() {
  const p = useSearchParams();
  const address = p.get("address") ?? "", ns = p.get("ns") ?? "";
  const [out, setOut] = useState<any>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!address || !ns) return;
    fetch(`/api/export?as=B&format=json&address=${address}&namespace=${ns}`).then(async (r) => {
      const j = await r.json(); if (!r.ok) throw new Error(j.error); setOut(j);
    }).catch((e) => setErr(e.message));
  }, [address, ns]);
  const lines: string[] = out ? out.csv.trim().split("\n") : [];
  return (
    <main>
      <h2>Accountant view <small style={{ fontSize: 14, color: "#666" }}>(app B, separate delegate key)</small></h2>
      <p>Wallet <code>{address}</code>, memory <code>{ns}</code>. This page never asks questions: it reads the owner&rsquo;s saved rules from Walrus Memory and labels the history.</p>
      {err && <p style={{ color: "#b00" }}>{err}</p>}
      {!out && !err && <p>Reading rules from Walrus Memory…</p>}
      {out && (
        <>
          <p>
            Rules recalled: <b>{out.rules.count}</b> (memory holds {out.rules.listed}). Rows: {out.rows}. Still unknown: <b>{out.unknown}</b>.{" "}
            Data: {out.source === "cached" ? `cached at ${out.cachedAt}` : "live from Tatum"}.
          </p>
          {out.rules.incomplete && <p style={{ color: "#b60" }}>Recall returned fewer rules than memory holds. Reload before trusting this export.</p>}
          <p><a href={`/api/export?as=B&address=${address}&namespace=${ns}`}>Download CSV (app B)</a></p>
          <pre style={{ overflow: "auto", fontSize: 12, background: "#f6f6f6", padding: 8, maxHeight: 320 }}>{lines.slice(0, 16).join("\n")}{lines.length > 16 ? `\n… ${lines.length - 16} more rows` : ""}</pre>
        </>
      )}
    </main>
  );
}
export default function Page() { return <Suspense><View /></Suspense>; }
