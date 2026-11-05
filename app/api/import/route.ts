import { NextResponse } from "next/server";
import { runImport } from "@/lib/service";
import { fail } from "@/lib/http";
export const maxDuration = 60;
export async function POST(req: Request) {
  try { return NextResponse.json(await runImport(await req.json())); } catch (e) { return fail(e); }
}
