// What own-memory mode keeps in this browser (and nothing else). Kept tiny so the main page can load it eagerly.
const STORE = "lk-own-memory";
export type OwnMemory = { accountId: string; owner: string; privateKey: string; publicKey: string; keyAddress: string; label: string; createdAt: string; digests?: { create?: string; addKey?: string } };
// ---------- the key lives in this browser only ----------
export function loadOwn(): OwnMemory | null {
  try { const v = JSON.parse(localStorage.getItem(STORE) ?? "null"); return v?.privateKey && v?.accountId ? v : null; } catch { return null; }
}
export function saveOwn(m: OwnMemory) { localStorage.setItem(STORE, JSON.stringify(m)); }
export const ownRulesKey = (accountId: string) => `lk-own-rules-${accountId}`;   // the last good read of the rules (outage fallback)
// "Forget this browser" removes the key and the cached rules.
export function forgetOwn() {
  try { const m = loadOwn(); localStorage.removeItem(STORE); if (m) localStorage.removeItem(ownRulesKey(m.accountId)); } catch { /* storage blocked */ }
}

