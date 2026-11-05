import { NextResponse } from "next/server";
import { ANSWER_LABELS } from "@/lib/config";
import { ruleFromValue } from "@/lib/answers";
import { saveRule } from "@/lib/rules";
import { checkNamespace, UserError } from "@/lib/service";
import { fail } from "@/lib/http";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const namespace = checkNamespace(b.namespace);
    const match = String(b.match ?? "").trim().toLowerCase();
    if (!/^0x[0-9a-f]{1,64}(::[A-Za-z0-9_]+)?$/.test(match)) throw new UserError("Invalid match.");
    // `value` is "kind:exchange" / "label:swap"; a bare `label` is still accepted.
    const rule = b.value ? ruleFromValue(match, String(b.value))
      : (ANSWER_LABELS as readonly string[]).includes(b.label) ? { match, label: String(b.label) } : null;
    if (!rule) throw new UserError("Invalid answer.");
    const actionId = String(b.answerId ?? "");
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(actionId)) throw new UserError("Missing answer id.");
    // Returns as soon as the relayer accepts the job; the page polls /api/job for the blob id (~20 s).
    return NextResponse.json(await saveRule(namespace, rule, actionId));
  } catch (e) { return fail(e); }
}
