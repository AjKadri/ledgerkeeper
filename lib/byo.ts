// Own-memory mode ("Use my own memory (beta)"). Browser only.
// The user's wallet creates a Walrus Memory account and registers a delegate key made in this browser; after that
// the browser signs its own save/recall requests with that key. The key never leaves this browser.
import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { createAccount, addDelegateKey, removeDelegateKey, generateDelegateKey } from "@mysten-incubation/memwal/account";
import type { MemWal } from "@mysten-incubation/memwal";
import type { Rule } from "./classify";
import { memoryClient, outcomeToText, ruleToText, type Outcome } from "./memory";
import { recallWith, type RuleSet } from "./recall";

export const OWN_NAMESPACE = "ledgerkeeper-rules";
const CLOCK = "0x0000000000000000000000000000000000000000000000000000000000000006";
export const MIST = 1_000_000_000;

import { type OwnMemory } from "./byo-store";
export type { OwnMemory };
export type Chain = { packageId: string; registryId: string };

// ---------- relayer access through the same-origin pass-through ----------
export const relayUrl = () => `${location.origin}/api/relay`;
export function ownClient(m: OwnMemory): MemWal {
  return memoryClient({ key: m.privateKey, accountId: m.accountId, serverUrl: relayUrl(), namespace: OWN_NAMESPACE });
}
export const ownRecall = (m: OwnMemory): Promise<RuleSet> => recallWith(ownClient(m), OWN_NAMESPACE);

async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
// Same scheme as the server: a retry of the same answer is one memory; a correction (new answer id) is a new one.
async function write(m: OwnMemory, text: string, actionId?: string) {
  const key = (await sha256Hex(actionId === undefined ? `${OWN_NAMESPACE}|${text}` : `${OWN_NAMESPACE}|${actionId}|${text}`)).slice(0, 40);
  const r = await ownClient(m).remember(text, { idempotencyKey: key });
  return { jobId: r.job_id, status: r.status };
}
export const ownSaveRule = (m: OwnMemory, rule: Rule, answerId: string) => write(m, ruleToText(rule), answerId);
export const ownSaveOutcome = (m: OwnMemory, o: Outcome) => write(m, outcomeToText(o));
export const ownJob = (m: OwnMemory, jobId: string) => ownClient(m).getRememberStatus(jobId);

// ---------- chain ----------
export async function relayerChain(): Promise<Chain> {
  const r = await fetch(`${relayUrl()}/config`);
  if (!r.ok) throw new Error("Could not read the Walrus Memory configuration.");
  const j = await r.json();
  return { packageId: j.packageId, registryId: j.registryId };
}

// The registry keeps a table owner address -> account id. null = this wallet has no account yet.
export async function findAccountId(client: any, chain: Chain, owner: string): Promise<string | null> {
  const reg = await client.core.getObject({ objectId: chain.registryId, include: { json: true } });
  const table = reg.object?.json?.accounts?.id;
  if (!table) throw new Error("Could not read the Walrus Memory registry.");
  try {
    const f = await client.core.getDynamicField({ parentId: table, name: { type: "address", bcs: bcs.Address.serialize(owner).toBytes() } });
    const bytes = f.dynamicField?.value?.bcs;
    if (!bytes) return null;
    return "0x" + [...Object.values(bytes) as number[]].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch { return null; }
}

export const createAccountTx = (c: Chain) => { const tx = new Transaction(); tx.moveCall({ target: `${c.packageId}::account::create_account`, arguments: [tx.object(c.registryId), tx.object(CLOCK)] }); return tx; };
export const addKeyTx = (c: Chain, accountId: string, publicKey: Uint8Array, label: string) => {
  const tx = new Transaction();
  tx.moveCall({ target: `${c.packageId}::account::add_delegate_key`, arguments: [tx.object(accountId), tx.object(c.registryId), tx.pure.vector("u8", Array.from(publicKey)), tx.pure.string(label), tx.object(CLOCK)] });
  return tx;
};
export const removeKeyTx = (c: Chain, accountId: string, publicKey: Uint8Array) => {
  const tx = new Transaction();
  tx.moveCall({ target: `${c.packageId}::account::remove_delegate_key`, arguments: [tx.object(accountId), tx.object(c.registryId), tx.pure.vector("u8", Array.from(publicKey))] });
  return tx;
};

// Simulates the transaction (nothing is signed or sent) and reports the network fee in SUI.
export type GasEstimate = { ok: true; sui: number; detail: string } | { ok: false; reason: string };
export async function estimateGas(client: any, sender: string, tx: Transaction): Promise<GasEstimate> {
  try {
    tx.setSender(sender);
    const r = await client.core.simulateTransaction({ transaction: tx, include: { effects: true } });
    const t = r.Transaction ?? r.FailedTransaction;
    if (!t?.status?.success) return { ok: false, reason: typeof t?.status?.error === "string" ? t.status.error : (t?.status?.error?.message ?? "The simulation failed.") };
    const g = t.effects.gasUsed;
    const net = (Number(g.computationCost) + Number(g.storageCost) - Number(g.storageRebate)) / MIST;
    return { ok: true, sui: Math.max(net, 0), detail: `network ${(Number(g.computationCost) / MIST).toFixed(6)} + storage ${(Number(g.storageCost) / MIST).toFixed(6)} − rebate ${(Number(g.storageRebate) / MIST).toFixed(6)}` };
  } catch (e) {
    const m = (e as Error).message;
    return { ok: false, reason: /gas|coin|balance|insufficient/i.test(m) ? "Your wallet does not have enough SUI for the network fee." : m.slice(0, 160) };
  }
}

// ---------- wallet-signed steps ----------
export type WalletSigner = { address: string; signAndExecuteTransaction: (i: { transaction: any }) => Promise<any>; signPersonalMessage?: any };
export async function doCreateAccount(chain: Chain, walletSigner: WalletSigner, suiClient: any) {
  return createAccount({ ...chain, walletSigner: walletSigner as any, suiClient });
}
export async function makeBrowserKey() { return generateDelegateKey(); }
export async function doAddKey(chain: Chain, accountId: string, publicKey: Uint8Array, label: string, walletSigner: WalletSigner, suiClient: any) {
  return addDelegateKey({ ...chain, accountId, publicKey, label, walletSigner: walletSigner as any, suiClient });
}
export async function doRemoveKey(chain: Chain, accountId: string, publicKey: Uint8Array, walletSigner: WalletSigner, suiClient: any) {
  return removeDelegateKey({ ...chain, accountId, publicKey, walletSigner: walletSigner as any, suiClient });
}
