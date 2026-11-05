// Transaction history through Tatum's Sui GraphQL gateway, with a server-side cache for demo wallets.
import { fetchTxs, type Tx } from "./gql";
import { HISTORY_START, HISTORY_START_CHECKPOINT } from "./config";
import w1 from "../fixtures/wallet1.json";
import w2 from "../fixtures/wallet2.json";
import w3 from "../fixtures/wallet3.json";

const CACHED_AT = "2026-11-05";
const CACHE: Record<string, Tx[]> = Object.fromEntries(
  [w1, w2, w3].map((f: any) => [f.wallet.toLowerCase(), f.txs as Tx[]]),
);

export type History = { txs: Tx[]; source: "cached" | "live"; cachedAt?: string; note?: string };

export async function getHistory(address: string, opts: { forceCache?: boolean } = {}): Promise<History> {
  const key = address.toLowerCase();
  const cached = CACHE[key];
  // Demo wallets are served from the cache (free-plan rate limits); anything else is read live.
  if (cached && (opts.forceCache || process.env.USE_LIVE_TATUM !== "true"))
    return { txs: cached, source: "cached", cachedAt: CACHED_AT };
  try {
    const txs = await fetchTxs({ affectedAddress: key, afterCheckpoint: HISTORY_START_CHECKPOINT }, 500);
    return { txs, source: "live" };
  } catch (e) {
    if (cached) return { txs: cached, source: "cached", cachedAt: CACHED_AT, note: "Tatum unavailable, showing cached data" };
    throw new Error(`Could not read history from Tatum: ${(e as Error).message.slice(0, 200)}`);
  }
}

export function inRange(txs: Tx[], from?: string, to?: string): Tx[] {
  return txs.filter((t) => {
    const d = (t.timestamp ?? "").slice(0, 10);
    return (!from || d >= from) && (!to || d <= to);
  });
}

export const EMPTY_MESSAGE = `No transactions found for this address since ${HISTORY_START}. History before that date is not available.`;
