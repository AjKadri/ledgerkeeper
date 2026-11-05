import { NextResponse } from "next/server";
import { recallRules } from "@/lib/rules";
import { checkNamespace } from "@/lib/service";
import { fail } from "@/lib/http";
export const maxDuration = 60;
export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const app = u.searchParams.get("as") === "B" ? "B" : "A";
    return NextResponse.json(await recallRules(app, checkNamespace(u.searchParams.get("namespace"))));
  } catch (e) { return fail(e); }
}
