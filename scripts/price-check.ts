// Hand-check of 3 transactions: our pool-derived SUI/USD vs CoinGecko's public price
// (the daily 00:00 UTC value and the nearest hourlyute point).
//   npx tsx scripts/price-check.ts
import { readFileSync } from "node:fs";
import { priceAt } from "../lib/price";

const f = JSON.parse(readFileSync("fixtures/wallet3.json", "utf8"));
const w = f.wallet.toLowerCase();
const withSui = f.txs
  .map((t: any) => ({
    t,
    sui: t.balanceChanges
      .filter((b: any) => b.owner?.toLowerCase() === w && b.coinType.endsWith("::sui::SUI"))
      .reduce((s: number, b: any) => s + Number(b.amount), 0) / 1e9,
  }))
  .filter((x: any) => Math.abs(x.sui) > 10)
  .sort((a: any, b: any) => a.t.timestamp.localeCompare(b.t.timestamp));
const picks = [withSui[0], withSui[Math.floor(withSui.length / 2)], withSui[withSui.length - 1]];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function cg(path: string) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch("https://api.coingecko.com/api/v3" + path);
    if (r.ok) return r.json();
    await sleep(15000);
  }
  throw new Error("coingecko failed: " + path);
}
const pct = (a: number, b: number) => ((a - b) / b) * 100;
const sgn = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(2) + "%";

let ok = true;
for (const { t, sui } of picks) {
  const ts = Date.parse(t.timestamp);
  const ours = priceAt(t.timestamp)!;
  const d = new Date(ts);
  const dd = `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
  const daily = (await cg(`/coins/sui/history?date=${dd}&localization=false`)).market_data.current_price.usd as number;
  await sleep(9000);
  const from = Math.floor(ts / 1000) - 10800, to = Math.floor(ts / 1000) + 10800;
  const chart = (await cg(`/coins/sui/market_chart/range?vs_currency=usd&from=${from}&to=${to}`)).prices as [number, number][];
  const near = chart.reduce((a, b) => (Math.abs(b[0] - ts) < Math.abs(a[0] - ts) ? b : a));
  await sleep(9000);
  const dDaily = pct(ours, daily), dNear = pct(ours, near[1]);
  const pass = Math.abs(dDaily) <= 3 && Math.abs(dNear) <= 3;
  ok = ok && pass;
  console.log(
    `${t.digest.slice(0, 8)} ${t.timestamp.slice(0, 16)}Z  SUI leg ${sui.toFixed(2)}` +
      `  pool $${ours.toFixed(4)}` +
      `  | CoinGecko daily ${dd} 00:00 $${daily.toFixed(4)} (${sgn(dDaily)})` +
      `  | nearest hourly $${near[1].toFixed(4)} @${new Date(near[0]).toISOString().slice(11, 16)} (${sgn(dNear)})` +
      `  ${pass ? "PASS" : "FAIL"}  USD value ${(sui * ours).toFixed(2)}`,
  );
}
console.log(ok ? "PRICE CHECK PASS (all within 3%)" : "PRICE CHECK FAIL");
process.exit(ok ? 0 : 1);
