// Transaction history through Tatum's Sui GraphQL gateway, with a server-side cache for demo wallets.
import { fetchTxs, gql, type Tx } from "./gql";
import { HISTORY_START, HISTORY_START_CHECKPOINT } from "./config";
import w1 from "../fixtures/wallet1.json";
import w2 from "../fixtures/wallet2.json";
import w3 from "../fixtures/wallet3.json";

const CACHED_AT = "2026-11-05";
const CACHE: Record<string, Tx[]> = Object.fromEntries(
  [w1, w2, w3].map((f: any) => [f.wallet.toLowerCase(), f.txs as Tx[]]),
);

export const LIVE_CAP = 500;
export type History = { txs: Tx[]; source: "cached" | "live"; cachedAt?: string; note?: string; truncated?: boolean };

export async function getHistory(address: string, opts: { forceCache?: boolean } = {}): Promise<History> {
  const key = address.toLowerCase();
  const cached = CACHE[key];
  // Demo wallets are served from the cache (free-plan rate limits); anything else is read live.
  if (cached && (opts.forceCache || process.env.USE_LIVE_TATUM !== "true"))
    return { txs: cached, source: "cached", cachedAt: CACHED_AT };
  try {
    const txs = await fetchTxs({ affectedAddress: key, afterCheckpoint: HISTORY_START_CHECKPOINT }, LIVE_CAP);
    const truncated = txs.length >= LIVE_CAP;
    return { txs, source: "live", truncated, note: truncated ? `Showing the newest ${txs.length} transactions only.` : undefined };
  } catch (e) {
    if (cached) return { txs: cached, source: "cached", cachedAt: CACHED_AT, note: "Tatum unavailable, showing cached data" };
    console.error("tatum error:", (e as Error).message.slice(0, 200));
    throw new Error("Tatum did not respond (could not read this address's history). Please try again in a minute.");
  }
}

export function inRange(txs: Tx[], from?: string, to?: string): Tx[] {
  return txs.filter((t) => {
    const d = (t.timestamp ?? "").slice(0, 10);
    return (!from || d >= from) && (!to || d <= to);
  });
}

// Best effort: tell "empty wallet" from "only older activity" using the current SUI balance.
export async function emptyMessage(address: string): Promise<string> {
  return (await emptyInfo(address)).message;
}
export async function emptyInfo(address: string): Promise<{ message: string; reason?: string }> {
  try {
    const d = await gql(`query($a:SuiAddress!){address(address:$a){balance(coinType:"0x2::sui::SUI"){totalBalance}}}`, { a: address }, 2);
    if (BigInt(d.address?.balance?.totalBalance ?? "0") > 0n)
      return { message: `No transactions since ${HISTORY_START}. This address holds funds, so its activity is probably older, and history before ${HISTORY_START} is not available.`, reason: "no_recent_activity" };
  } catch { /* fall through */ }
  return { message: `No transactions found for this address since ${HISTORY_START}. It may be an empty wallet, or its activity may be older than the available history (before ${HISTORY_START}).` };
}
