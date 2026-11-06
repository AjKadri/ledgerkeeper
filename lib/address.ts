import { ADDRESS_RE } from "./config";

// Live feedback for the address field, shared by the product page and the app.
export function checkAddress(v: string): { ok: boolean; text: string } {
  if (!v) return { ok: false, text: "Paste a Sui address: 0x followed by 64 characters." };
  if (!v.startsWith("0x")) return { ok: false, text: "A Sui address starts with 0x." };
  if (!/^0x[0-9a-fA-F]*$/.test(v)) return { ok: false, text: "After 0x only the characters 0–9 and a–f are allowed." };
  if (v.length < 66) return { ok: false, text: `Keep going: ${v.length} of 66 characters.` };
  if (v.length > 66) return { ok: false, text: `Too long: ${v.length} characters, a Sui address has 66.` };
  return { ok: ADDRESS_RE.test(v), text: "Valid Sui address" };
}
