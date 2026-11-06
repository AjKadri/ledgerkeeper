import { NextResponse } from "next/server";
import { runExport } from "@/lib/service";
import { fail } from "@/lib/http";
export const maxDuration = 60;
// as=A uses delegate key A (the main app); as=B uses delegate key B only (the accountant view).
export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const app = u.searchParams.get("as") === "B" ? "B" : "A";
    const out = await runExport(app, { address: u.searchParams.get("address"), namespace: u.searchParams.get("namespace") });
    if (u.searchParams.get("format") === "json") return NextResponse.json({ ...out, app });
    return new NextResponse(out.csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="ledgerkeeper-${app}.csv"` } });
  } catch (e) { return fail(e); }
}

// Own-memory mode: the browser sends the rule set it recalled with its own key; nothing is read from the demo memory.
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const out = await runExport("A", { address: b.address, namespace: undefined, ruleSet: b.ruleSet ?? {} });
    return new NextResponse(out.csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="ledgerkeeper-own-memory.csv"' } });
  } catch (e) { return fail(e); }
}
