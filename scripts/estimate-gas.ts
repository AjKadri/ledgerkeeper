// Read-only gas estimate for the two on-chain steps of "Use my own memory" (simulation only: nothing is signed or sent).
// Run: npx tsx scripts/estimate-gas.ts   (reads MEMWAL_ACCOUNT_ID from .env.local only to find an existing account owner)
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

const CLOCK = "0x0000000000000000000000000000000000000000000000000000000000000006";
const cfg = await (await fetch("https://relayer.memory.walrus.xyz/config")).json();
const client = new SuiGrpcClient({ network: "mainnet", baseUrl: "https://fullnode.mainnet.sui.io:443" });
const mist = (n: string | number) => Number(n);
const sui = (n: number) => (n / 1e9).toFixed(6);

async function sim(label: string, sender: string, build: (tx: Transaction) => void) {
  const tx = new Transaction(); tx.setSender(sender); build(tx);
  const r: any = await client.core.simulateTransaction({ transaction: tx, include: { effects: true }, checksEnabled: false });
  const t = r.Transaction ?? r.FailedTransaction; const g = t.effects.gasUsed;
  const net = mist(g.computationCost) + mist(g.storageCost) - mist(g.storageRebate) + mist(g.nonRefundableStorageFee ?? 0);
  console.log(`${label}: ${t.status.success ? "ok" : "FAILED " + JSON.stringify(t.status.error)}  computation ${sui(mist(g.computationCost))} + storage ${sui(mist(g.storageCost))} - rebate ${sui(mist(g.storageRebate))} = ${sui(net)} SUI`);
  return net;
}

const fresh = Ed25519Keypair.generate().getPublicKey().toSuiAddress();
const a = await sim("create_account", fresh, (tx) => { tx.moveCall({ target: `${cfg.packageId}::account::create_account`, arguments: [tx.object(cfg.registryId), tx.object(CLOCK)] }); });

// add_delegate_key needs an existing account and its owner as sender; use the builder's demo account (read-only simulation).
const acct = process.env.MEMWAL_ACCOUNT_ID!;
const obj: any = await client.core.getObject({ objectId: acct, include: { json: true } });
const owner = obj.object.json?.owner as string;
const pk = Array.from(Ed25519Keypair.generate().getPublicKey().toRawBytes());
const b = await sim("add_delegate_key", owner, (tx) => { tx.moveCall({ target: `${cfg.packageId}::account::add_delegate_key`, arguments: [tx.object(acct), tx.object(cfg.registryId), tx.pure.vector("u8", pk), tx.pure.string("LedgerKeeper (this browser)"), tx.object(CLOCK)] }); });
console.log(`total for the two steps: about ${sui(a + b)} SUI (before the wallet adds its own gas budget margin)`);
