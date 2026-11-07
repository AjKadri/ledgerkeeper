// Outage fallback helpers shared by the server and the browser (no Node imports).
// When Walrus Memory cannot be read, the app keeps working from the rules it last read successfully.
export type Stale = { at: string };            // ISO time of the last successful read

// "14:32" for today, "7 Nov, 14:32" otherwise.
export function readAtText(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "an earlier time";
  const hm = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === now.toDateString() ? hm : `${d.getDate()} ${d.toLocaleString("en-GB", { month: "short" })}, ${hm}`;
}
export const outageText = (s: Stale) => `Memory unavailable, using your rules as last read at ${readAtText(s.at)}.`;
export const OUTAGE_NO_SAVE = "Saving is turned off until Walrus Memory answers again. Nothing you did is lost; run the import again to retry.";

// A rule set is only worth caching when the read was complete.
export type Cached<T> = { rs: T; at: string };
export function boundedSet<T>(m: Map<string, T>, key: string, value: T, max = 200) {
  m.delete(key); m.set(key, value);
  while (m.size > max) m.delete(m.keys().next().value as string);
}
