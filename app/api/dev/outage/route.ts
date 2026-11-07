import { NextResponse } from "next/server";
import { outageSim } from "@/lib/rules";
// Development-only switch used to test the outage fallback on a local server: /api/dev/outage?on=1 (or 0).
// It does nothing and answers 404 in production.
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });
  const on = new URL(req.url).searchParams.get("on");
  if (on === "1") outageSim.down = true; else if (on === "0") outageSim.down = false;
  return NextResponse.json({ simulatedOutage: outageSim.down });
}
