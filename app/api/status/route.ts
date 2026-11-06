import { NextResponse } from "next/server";
import { writesAllowed } from "@/lib/rules";
// Tells the page whether memory writes are on (the kill switch and the hourly cap).
export async function GET() {
  const w = writesAllowed();
  // accountId is the demo Walrus Memory account (an on-chain object id, public).
  return NextResponse.json({ writesEnabled: w.ok, reason: w.reason ?? null, accountId: process.env.MEMWAL_ACCOUNT_ID ?? null });
}
