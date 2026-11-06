// A same-origin pass-through to the Walrus Memory relayer for own-memory mode.
// Why: the relayer answers browser calls only for its own allowlisted origins (checked 6 Nov 2026: no
// access-control-allow-origin for ledgerkeeper.vercel.app or localhost), so the browser cannot call it directly.
// The browser signs every request with its own delegate key; this route only forwards the signed request and
// the response. It never sees a private key, adds no credentials and drops everything but a short header allowlist.
import { allowedRelayPath } from "@/lib/relay";
export const maxDuration = 60;
const BASE = (process.env.MEMWAL_SERVER_URL ?? "https://relayer.memory.walrus.xyz").replace(/\/$/, "");
const FORWARD = ["content-type", "x-public-key", "x-signature", "x-timestamp", "x-nonce", "x-account-id", "x-delegate-key", "x-request-id", "x-memwal-account-id", "x-memwal-namespace", "x-seal-session"];
const RETURN = ["content-type", "retry-after", "x-auth-error", "x-request-id"];

async function relay(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const p = path.join("/");
  if (!allowedRelayPath(p)) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "content-type": "application/json" } });
  const headers = new Headers();
  for (const h of FORWARD) { const v = req.headers.get(h); if (v) headers.set(h, v); }
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();
  if (body && body.byteLength > 1_000_000) return new Response(JSON.stringify({ error: "Request too large" }), { status: 413, headers: { "content-type": "application/json" } });
  try {
    const up = await fetch(`${BASE}/${p}${new URL(req.url).search}`, { method: req.method, headers, body, signal: AbortSignal.timeout(55_000), cache: "no-store" });
    const out = new Headers();
    for (const h of RETURN) { const v = up.headers.get(h); if (v) out.set(h, v); }
    out.set("cache-control", "no-store");
    return new Response(await up.arrayBuffer(), { status: up.status, headers: out });
  } catch {
    return new Response(JSON.stringify({ error: "The memory relayer did not answer. Try again." }), { status: 502, headers: { "content-type": "application/json" } });
  }
}
export const GET = relay, POST = relay;
