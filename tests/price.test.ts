import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { priceAt, type PriceTable } from "../lib/price.ts";
import { toRows, toCsv, CSV_COLUMNS } from "../lib/export.ts";

const table: PriceTable = { prices: {
  "2026-05-01": { checkpoint: 1, ts: "2026-05-01T12:00:00Z", price: 1.0 },
  "2026-05-02": { checkpoint: 2, ts: "2026-05-02T12:00:00Z", price: 1.2 },
} };

test("price interpolates linearly between daily anchors", () => {
  assert.equal(priceAt("2026-05-01T12:00:00Z", table), 1.0);
  assert.ok(Math.abs(priceAt("2026-05-02T00:00:00Z", table)! - 1.1) < 1e-9);
  assert.ok(Math.abs(priceAt("2026-05-02T12:00:00Z", table)! - 1.2) < 1e-9);
});

test("price outside the table: edge anchor within 36 h, otherwise null", () => {
  assert.equal(priceAt("2026-04-30T12:00:00Z", table), 1.0);   // 24 h before the first anchor
  assert.equal(priceAt("2026-05-03T12:00:00Z", table), 1.2);   // 24 h after the last
  assert.equal(priceAt("2026-04-20T00:00:00Z", table), null);
  assert.equal(priceAt("2026-06-01T00:00:00Z", table), null);
  assert.equal(priceAt(null, table), null);
});

const load = (n: string) => JSON.parse(readFileSync(new URL(`../fixtures/${n}.json`, import.meta.url), "utf8"));

test("CSV has the USD columns; only SUI legs are valued, other coins stay blank", () => {
  const f = load("wallet3");
  const rows = toRows(f.txs, f.wallet, [], table as any);
  assert.ok(CSV_COLUMNS.includes("usd_value" as any) && CSV_COLUMNS.includes("usd_basis" as any));
  assert.ok(toCsv(rows).split("\n")[0].endsWith("sui_usd_price,usd_value,usd_basis"));
  for (const r of rows) {
    const hasSui = /SUI/.test(r.assets_in + r.assets_out);
    if (!hasSui) assert.equal(r.usd_value, "", "no SUI leg -> blank: " + r.digest);
    if (r.usd_value) assert.match(r.usd_basis, /approx\. on-chain pool price/);
  }
});

test("usd_value = net SUI change x price, signed (real price table)", () => {
  const f = load("wallet3");
  const w = f.wallet.toLowerCase();
  const rows = toRows(f.txs, f.wallet, []);
  const priced = rows.filter((r) => r.usd_value !== "");
  assert.ok(priced.length > 20, "most wallet3 transactions have a SUI leg and a price");
  for (const r of priced.slice(0, 10)) {
    const t = f.txs.find((x: any) => x.digest === r.digest);
    const net = t.balanceChanges.filter((b: any) => b.owner?.toLowerCase() === w && b.coinType.endsWith("::sui::SUI")).reduce((s: number, b: any) => s + Number(b.amount), 0) / 1e9;
    assert.ok(Math.abs(Number(r.usd_value) - net * Number(r.sui_usd_price)) < 0.02 + Math.abs(net) * 1e-4, r.digest);
  }
  // hand-checked row: 775.66 SUI received on 28 Apr 2026 is worth about $713 at ~$0.92
  const hand = rows.find((r) => r.digest.startsWith("DHTGLtGn"))!;
  assert.ok(Math.abs(Number(hand.usd_value) - 713.34) < 3);
});

test("A and B build the same CSV from the same rules (USD included)", () => {
  const f = load("wallet3");
  assert.equal(toCsv(toRows(f.txs, f.wallet, [])), toCsv(toRows(f.txs, f.wallet, [])));
});

import { amountLines, short, ago, dates } from "../lib/format.ts";

test("display formatting trims long decimals but keeps the full value for the tooltip and the CSV", () => {
  assert.deepEqual(amountLines("775.65751487 SUI", "+"), [{ text: "+775.658 SUI", full: "775.65751487 SUI" }]);
  assert.equal(amountLines("0.000528934 SUI; 0.050972928 CETUS", "+").map((a) => a.text).join(" | "), "+0.000529 SUI | +0.0510 CETUS".replace("0.0510", "0.051"));
  assert.equal(amountLines("17452000000000 (raw GIFT) GIFT", "+")[0].text, "+17,452,000,000,000 GIFT (raw units)");
  assert.deepEqual(amountLines("", "+"), []);
});

test("short addresses, dates and times", () => {
  assert.equal(short("0x60956e40d8f921affde3cb861de91a6a6a0bab28af7cd1c23e029d46b86a449b"), "0x6095…449b");
  assert.equal(short("0x33baf2b9efe76d63d07d911a6f6c6bf44e6df068c9eb1491bfcb826656b03209::nft"), "0x33ba…3209::nft");
  assert.equal(dates("2026-04-30", "2026-06-25"), "30 Apr – 25 Jun");
  assert.equal(dates("2026-06-25", "2026-06-25"), "25 Jun");
  const now = Date.parse("2026-11-06T12:00:00Z");
  assert.equal(ago("2026-11-06T11:58:00Z", now), "2 min ago");
  assert.equal(ago("2026-11-06T11:59:50Z", now), "just now");
});
