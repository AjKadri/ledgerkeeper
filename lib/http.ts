import { NextResponse } from "next/server";
import { UserError } from "./service";
export function fail(e: unknown) {
  if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: 400 });
  const msg = (e as Error).message ?? "Unexpected error";
  console.error("api error:", msg.slice(0, 300));
  return NextResponse.json({ error: msg.slice(0, 300) }, { status: 502 });
}
