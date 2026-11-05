import { NextResponse } from "next/server";
import { ANSWER_LABELS } from "@/lib/config";
import { saveRule } from "@/lib/rules";
import { checkNamespace, UserError } from "@/lib/service";
import { fail } from "@/lib/http";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const namespace = checkNamespace(b.namespace);
    const match = String(b.match ?? "").trim();
    if (!/^0x[0-9a-fA-F]{1,64}(::[A-Za-z0-9_]+)?$/.test(match)) throw new UserError("Invalid match.");
    if (!(ANSWER_LABELS as readonly string[]).includes(b.label)) throw new UserError("Invalid label.");
    // Returns as soon as the relayer accepts the job; the page polls /api/job for the blob id (~20 s).
    return NextResponse.json(await saveRule(namespace, { match: match.toLowerCase(), label: b.label }));
  } catch (e) { return fail(e); }
}
