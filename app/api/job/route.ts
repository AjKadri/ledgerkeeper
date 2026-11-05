import { NextResponse } from "next/server";
import { jobStatus } from "@/lib/rules";
import { checkNamespace } from "@/lib/service";
import { fail } from "@/lib/http";
export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const id = u.searchParams.get("id") ?? "";
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) throw new Error("bad job id");
    return NextResponse.json(await jobStatus(checkNamespace(u.searchParams.get("namespace")), id));
  } catch (e) { return fail(e); }
}
