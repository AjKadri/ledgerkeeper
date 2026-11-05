import { NextResponse } from "next/server";
import { UserError } from "./errors";

// User errors are shown as written; anything from an upstream service is logged and shown generically.
export function fail(e: unknown) {
  if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: 400 });
  const msg = (e as Error).message ?? "Unexpected error";
  console.error("api error:", msg.slice(0, 300));
  const friendly = /relayer|memwal|remember|recall|walrus/i.test(msg)
    ? "Walrus Memory did not accept the request. Nothing was saved. Please retry."
    : /tatum|graphql|HTTP \d{3}/i.test(msg)
      ? "Tatum did not respond. Please try again in a minute."
      : "Something went wrong. Please retry.";
  return NextResponse.json({ error: friendly }, { status: 502 });
}
