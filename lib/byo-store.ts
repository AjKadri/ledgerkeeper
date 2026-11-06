// What own-memory mode keeps in this browser (and nothing else). Kept tiny so the main page can load it eagerly.
const STORE = "lk-own-memory";
export type OwnMemory = { accountId: string; owner: string; privateKey: string; publicKey: string; keyAddress: string; label: string; createdAt: string; digests?: { create?: string; addKey?: string } };
// ---------- the key lives in this browser only ----------
export function loadOwn(): OwnMemory | null {
  try { const v = JSON.parse(localStorage.getItem(STORE) ?? "null"); return v?.privateKey && v?.accountId ? v : null; } catch { return null; }
}
export function saveOwn(m: OwnMemory) { localStorage.setItem(STORE, JSON.stringify(m)); }
export function forgetOwn() { try { localStorage.removeItem(STORE); } catch { /* storage blocked */ } }

