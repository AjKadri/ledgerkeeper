"use client";
import { useState } from "react";
import { checkAddress } from "@/lib/address";

// The real entry point: it hands straight over to /app.
export function HeroForm() {
  const [address, setAddress] = useState("");
  const a = checkAddress(address);
  const go = () => { if (a.ok) window.location.href = `/app?address=${address}`; };
  return (
    <div className="hero__form">
      <label htmlFor="hero-addr" className="sr-only">Sui address</label>
      <input id="hero-addr" className="field" value={address} spellCheck={false} autoComplete="off" autoCapitalize="off" placeholder="0x… paste a Sui address"
        aria-describedby="hero-hint" aria-invalid={!!address && !a.ok && address.length >= 66 ? true : undefined}
        onChange={(e) => setAddress(e.target.value.trim())} onKeyDown={(e) => { if (e.key === "Enter") go(); }} />
      <p id="hero-hint" className={`hint ${a.ok ? "hint--ok" : address && (/[^0-9a-fx]/i.test(address.slice(1)) || address.length > 66) ? "hint--bad" : ""}`} aria-live="polite">{a.text}</p>
      <div className="hero__actions">
        <a className="btn btn--primary" href="/app?sample=1">Try the sample wallet</a>
        <button type="button" className="btn" disabled={!a.ok} onClick={go}>Import my wallet</button>
      </div>
    </div>
  );
}
