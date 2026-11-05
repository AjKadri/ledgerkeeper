// Builds data/sui-usd.json: SUI/USD from the Cetus SUI/USDC CLMM pool via Tatum GraphQL, one anchor per UTC day at ~12:00.
//   npx tsx scripts/build-prices.ts            (resumes from the existing file)
import { config } from "dotenv"; config({ path: ".env.local" });
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { gql } from "../lib/gql";

const POOL = "0xb8d7d9e66a60c239e7a60110efcf8de6c705580ed924d0dde141f4a0e2c90105"; // Cetus SUI/USDC (coin A = USDC 6 dp, coin B = SUI 9 dp)
const OUT = "data/sui-usd.json";
const START = "2026-01-24"; // history starts 23 Jan 22:30 UTC; first full noon is 24 Jan
type Anchor = { checkpoint: number; ts: string; price: number };
const table: { pool: string; basis: string; builtAt: string; prices: Record<string, Anchor> } =
  existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { pool: POOL, basis: "Cetus SUI/USDC pool, price at the checkpoint nearest 12:00 UTC", builtAt: "", prices: {} };

const cpTime = async (n: number) => Date.parse((await gql(`query($n:UInt53){checkpoint(sequenceNumber:$n){timestamp}}`, { n })).checkpoint.timestamp);
async function price(cp: number) {
  const d = await gql(`query($a:SuiAddress!,$c:UInt53){object(address:$a,atCheckpoint:$c){asMoveObject{contents{json}}}}`, { a: POOL, c: cp });
  const sqrt = BigInt(d.object.asMoveObject.contents.json.current_sqrt_price);
  const a = Number(sqrt) / 2 ** 64;           // sqrt(price) in Q64.64; price = coin B raw per coin A raw
  return 1 / ((a * a) / 1000);                // SUI per USDC (adjust 6 vs 9 decimals), inverted to USD per SUI
}

let prev: { cp: number; t: number } | null = null, rate = 4.2;
const days = (a: string, b: string) => { const o: string[] = []; for (let t = Date.parse(a); t <= Date.parse(b); t += 86400000) o.push(new Date(t).toISOString().slice(0, 10)); return o; };
const today = new Date().toISOString().slice(0, 10);
for (const day of days(START, today)) {
  const target = Date.parse(day + "T12:00:00Z");
  if (target > Date.now() - 60_000) break;                       // noon not reached yet
  if (table.prices[day]) { prev = { cp: table.prices[day].checkpoint, t: Date.parse(table.prices[day].ts) }; continue; }
  let cp: number = prev ? Math.round(prev.cp + ((target - prev.t) / 1000) * rate) : 237661232 + Math.round(((target - Date.parse("2026-01-23T22:30:07Z")) / 1000) * rate);
  let t: number = await cpTime(cp);
  for (let i = 0; i < 6 && Math.abs(target - t) > 15 * 60_000; i++) {
    const nrate = prev && t !== prev.t ? (cp - prev.cp) / ((t - prev.t) / 1000) : rate;
    if (isFinite(nrate) && nrate > 1 && nrate < 10) rate = nrate;
    cp += Math.round(((target - t) / 1000) * rate); t = await cpTime(cp);
  }
  table.prices[day] = { checkpoint: cp, ts: new Date(t).toISOString(), price: +(await price(cp)).toFixed(5) };
  prev = { cp, t };
  console.log(day, cp, table.prices[day].ts, table.prices[day].price);
  table.builtAt = new Date().toISOString();
  writeFileSync(OUT, JSON.stringify(table, null, 1));
}
console.log("done", Object.keys(table.prices).length, "days");
