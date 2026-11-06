import { NextResponse } from "next/server";
import { saveOutcome } from "@/lib/rules";
import { checkAddress, checkNamespace, UserError } from "@/lib/service";
import { fail } from "@/lib/http";
export const maxDuration = 60;
// One outcome memory per distinct import result (the idempotency key comes from the text): "[import] wallet=… range=… txs=… asked=… answered=… reused=… v=1".
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const n = (v: unknown) => { const x = Number(v); if (!Number.isInteger(x) || x < 0 || x > 100000) throw new UserError("Invalid number."); return x; };
    const range = String(b.range ?? "");
    if (!/^[0-9a-z-]+\.\.[0-9a-z-]+$/.test(range)) throw new UserError("Invalid range.");
    const o = { wallet: checkAddress(b.address), range, txs: n(b.txs), asked: n(b.asked), answered: n(b.answered), reused: n(b.reused) };
    return NextResponse.json(await saveOutcome(checkNamespace(b.namespace), o));
  } catch (e) { return fail(e); }
}
