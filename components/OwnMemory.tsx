"use client";
// "Use my own memory (beta)": connect a wallet, make sure it has a Walrus Memory account, register a key made in this
// browser, then save and recall with that key. Every on-chain step shows what it does and its fee before it is asked.
import { useCallback, useEffect, useRef, useState } from "react";
import { DAppKitProvider, useCurrentAccount, useCurrentClient, useDAppKit } from "@mysten/dapp-kit-react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { dAppKit } from "@/lib/dapp-kit";
import {
  addKeyTx, createAccountTx, doAddKey, doCreateAccount, doRemoveKey, estimateGas, findAccountId, makeBrowserKey,
  relayerChain, removeKeyTx, type Chain, type GasEstimate,
} from "@/lib/byo";
import { forgetOwn, saveOwn, type OwnMemory } from "@/lib/byo-store";
import { Copyable } from "./ui";

const KEY_WARNING = "This key is stored in this browser only. Anyone with access to this browser can use it.";
const scan = (d: string) => `https://suiscan.xyz/mainnet/tx/${d}`;
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

// The confirm box shown before every wallet transaction: what it does, what it costs, then the button.
function Confirm({ title, does, est, balance, busy, action, onGo, onCancel }: {
  title: string; does: string[]; est: GasEstimate | null; balance: number | null; busy: boolean; action: string; onGo: () => void; onCancel?: () => void;
}) {
  return (
    <div className="own__confirm" role="group" aria-label={title}>
      <h4>{title}</h4>
      <ul>{does.map((d) => <li key={d}>{d}</li>)}</ul>
      <p className="own__fee" aria-live="polite">
        {!est ? "Estimating the network fee…"
          : est.ok ? <>Estimated network fee: <b className="num">≈ {est.sui.toFixed(4)} SUI</b>, paid from your wallet on Sui mainnet. LedgerKeeper takes no fee. <span className="small muted">({est.detail})</span></>
          : <span className="own__bad">Cannot continue: {est.reason}</span>}
      </p>
      {balance !== null && (
        <p className={balance < 0.02 ? "own__bad" : "small muted"}>
          Your wallet holds <span className="num">{balance.toFixed(4)} SUI</span>.{balance < 0.02 && " That is too little: the wallet reserves a gas budget of about 0.01 to 0.02 SUI before the fee is settled. Add some SUI first."}
        </p>
      )}
      <div className="own__row">
        <button type="button" className="btn btn--primary" disabled={busy || !est || !est.ok || (balance !== null && balance < 0.02)} onClick={onGo}>{busy ? "Waiting for your wallet…" : action}</button>
        {onCancel && <button type="button" className="btn btn--quiet" disabled={busy} onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}

function Inner({ own, onReady, onForget }: { own: OwnMemory | null; onReady: (m: OwnMemory) => void; onForget: () => void }) {
  const kit = useDAppKit();
  const client = useCurrentClient() as any;
  const account = useCurrentAccount();
  const [chain, setChain] = useState<Chain | null>(null);
  const [accountId, setAccountId] = useState<string | null | undefined>(undefined);   // undefined = looking, null = none
  const [createDigest, setCreateDigest] = useState("");
  const [step, setStep] = useState<"idle" | "create" | "key" | "remove">("idle");
  const [est, setEst] = useState<GasEstimate | null>(null);
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [removed, setRemoved] = useState("");
  const keyRef = useRef<{ privateKey: string; publicKey: Uint8Array; suiAddress: string } | null>(null);

  const signer = useCallback(() => ({
    address: account!.address,
    signAndExecuteTransaction: ({ transaction }: { transaction: any }) => kit.signAndExecuteTransaction({ transaction }),
  }), [account, kit]);

  useEffect(() => { relayerChain().then(setChain).catch((e) => setErr(e.message)); }, []);
  useEffect(() => {                                   // does the connected wallet already have an account?
    if (!account || !chain || own) return;
    let live = true; setAccountId(undefined); setErr("");
    findAccountId(client, chain, account.address).then((id) => { if (live) setAccountId(id); }).catch((e) => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [account, chain, client, own]);

  useEffect(() => {                                   // the wallet balance, so a too-small wallet is caught before the wallet prompt
    if (!account || step === "idle") return;
    let live = true;
    client.core.getBalance({ owner: account.address }).then((r: any) => { if (live) setBalance(Number(r.balance.balance) / 1e9); }).catch(() => { if (live) setBalance(null); });
    return () => { live = false; };
  }, [account, step, client]);

  // fee estimate for whichever step is open
  useEffect(() => {
    if (!account || !chain) return;
    setEst(null);
    let live = true;
    (async () => {
      if (step === "create") return estimateGas(client, account.address, createAccountTx(chain));
      if (step === "key" && accountId) {
        if (!keyRef.current) keyRef.current = await makeBrowserKey();
        return estimateGas(client, account.address, addKeyTx(chain, accountId, keyRef.current.publicKey, "LedgerKeeper (this browser)"));
      }
      if (step === "remove" && own) return estimateGas(client, account.address, removeKeyTx(chain, own.accountId, hexToBytes(own.publicKey)));
      return null;
    })().then((r) => { if (live && r) setEst(r); }).catch((e) => { if (live) setEst({ ok: false, reason: e.message }); });
    return () => { live = false; };
  }, [step, account, chain, accountId, client, own]);

  async function run(fn: () => Promise<void>) {
    setBusy(true); setErr("");
    try { await fn(); } catch (e) { setErr(String((e as Error).message ?? e).slice(0, 300)); } finally { setBusy(false); }
  }

  const create = () => run(async () => {
    const r = await doCreateAccount(chain!, signer(), client);
    if (!r.accountId) throw new Error(`The transaction ${r.digest} went through but no account id was returned. Reload and connect again.`);
    setCreateDigest(r.digest); setAccountId(r.accountId); setStep("idle");
  });
  const addKey = () => run(async () => {
    const k = keyRef.current!;
    const r = await doAddKey(chain!, accountId!, k.publicKey, "LedgerKeeper (this browser)", signer(), client);
    const m: OwnMemory = { accountId: accountId!, owner: account!.address, privateKey: k.privateKey, publicKey: hex(k.publicKey), keyAddress: k.suiAddress, label: "LedgerKeeper (this browser)", createdAt: new Date().toISOString(), digests: { create: createDigest || undefined, addKey: r.digest } };
    saveOwn(m); keyRef.current = null; setStep("idle"); onReady(m);
  });
  const removeKey = () => run(async () => {
    const r = await doRemoveKey(chain!, own!.accountId, hexToBytes(own!.publicKey), signer(), client);
    setRemoved(r.digest); forgetOwn(); setStep("idle"); onForget();
  });

  // ---- ready: a key is stored in this browser ----
  if (own) {
    const mine = account && account.address.toLowerCase() === own.owner.toLowerCase();
    return (
      <div className="own">
        <p><b>Using your own memory.</b> Answers are saved to your Walrus Memory account with a key made in this browser.</p>
        <dl className="own__facts">
          <div><dt>Account</dt><dd><Copyable value={own.accountId} shown={own.accountId.slice(0, 10) + "…" + own.accountId.slice(-6)} /></dd></div>
          <div><dt>Owner wallet</dt><dd><Copyable value={own.owner} shown={own.owner.slice(0, 10) + "…" + own.owner.slice(-6)} /></dd></div>
          <div><dt>Browser key</dt><dd><Copyable value={own.keyAddress} shown={own.keyAddress.slice(0, 10) + "…" + own.keyAddress.slice(-6)} /></dd></div>
          {own.digests?.create && <div><dt>Create account tx</dt><dd><a href={scan(own.digests.create)} target="_blank" rel="noreferrer">{own.digests.create.slice(0, 10)}…</a></dd></div>}
          {own.digests?.addKey && <div><dt>Add key tx</dt><dd><a href={scan(own.digests.addKey)} target="_blank" rel="noreferrer">{own.digests.addKey.slice(0, 10)}…</a></dd></div>}
        </dl>
        <p className="own__warn" role="note">{KEY_WARNING}</p>
        <div className="own__row">
          <button type="button" className="btn" onClick={() => { forgetOwn(); onForget(); }}>Forget this browser</button>
          <span className="small muted">Forgetting deletes the key from this browser. The key stays registered on your account until you remove it with your wallet.</span>
        </div>
        {step !== "remove" ? (
          <p className="small" style={{ marginTop: 12 }}>
            To also remove the key on-chain: <ConnectButton /> {mine && <button type="button" className="linkbtn" onClick={() => setStep("remove")}>Review the removal</button>}
            {account && !mine && <span className="own__bad"> This wallet is not the owner.</span>}
          </p>
        ) : (
          <Confirm title="Remove this key from your account" does={["Calls remove_delegate_key on your Walrus Memory account.", "The key can no longer sign requests. It is also deleted from this browser.", "Memories already saved stay in your memory."]}
            est={est} balance={balance} busy={busy} action="Remove in wallet" onGo={removeKey} onCancel={() => setStep("idle")} />
        )}
        {err && <p className="own__bad" role="alert">{err}</p>}
      </div>
    );
  }

  // ---- setup ----
  return (
    <div className="own">
      <p>Connect a Sui wallet (Slush or any standard wallet). LedgerKeeper never sees your wallet&rsquo;s keys or recovery phrase. Your wallet signs two transactions: one to create your memory account if you have none, one to register a key made in this browser.</p>
      <p className="own__row"><ConnectButton /> {account && <span className="small muted">Connected: <span className="mono">{account.address.slice(0, 8)}…{account.address.slice(-4)}</span></span>}</p>

      {account && accountId === undefined && !err && <p className="small muted" role="status">Looking for your memory account…</p>}

      {account && accountId === null && step !== "create" && (
        <div className="own__box">
          <p><b>This wallet has no Walrus Memory account yet.</b> One account per wallet; it holds your rules.</p>
          <button type="button" className="btn btn--primary" onClick={() => setStep("create")}>Review account creation</button>
        </div>
      )}
      {account && step === "create" && (
        <Confirm title="Create your Walrus Memory account" does={["Calls create_account on the Walrus Memory registry (mainnet).", "Creates one account object for this wallet. It cannot be created twice.", "Nothing is transferred to LedgerKeeper."]}
          est={est} balance={balance} busy={busy} action="Create account in wallet" onGo={create} onCancel={() => setStep("idle")} />
      )}

      {account && accountId && step !== "key" && (
        <div className="own__box">
          <p><b>{createDigest ? "Account created." : "Found your account."}</b> <Copyable value={accountId} shown={accountId.slice(0, 10) + "…" + accountId.slice(-6)} />{createDigest && <> · <a href={scan(createDigest)} target="_blank" rel="noreferrer">transaction</a></>}</p>
          <p className="small muted">Next: a key for this browser.</p>
          <button type="button" className="btn btn--primary" onClick={() => setStep("key")}>Review the browser key</button>
        </div>
      )}
      {account && accountId && step === "key" && (
        <>
          <Confirm title="Register a key for this browser" does={["A new key is made in this browser. Its private half never leaves the browser.", "Calls add_delegate_key on your account with its public half.", "The key can then save and read memories for your account until you remove it."]}
            est={est} balance={balance} busy={busy} action="Add key in wallet" onGo={addKey} onCancel={() => setStep("idle")} />
          <p className="own__warn" role="note">{KEY_WARNING}</p>
        </>
      )}
      {removed && <p className="small">Key removed on-chain: <a href={scan(removed)} target="_blank" rel="noreferrer">transaction</a></p>}
      {err && <p className="own__bad" role="alert">{err}</p>}
    </div>
  );
}

function hexToBytes(h: string) { return Uint8Array.from(h.match(/.{2}/g)!.map((x) => parseInt(x, 16))); }

export function OwnMemoryPanel(props: { own: OwnMemory | null; onReady: (m: OwnMemory) => void; onForget: () => void }) {
  return <DAppKitProvider dAppKit={dAppKit}><Inner {...props} /></DAppKitProvider>;
}
