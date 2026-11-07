import type { StepState } from "./ui";

export type Question = {
  key: string; count: number; question: string; repeat: boolean; in: number; out: number; first: string; last: string;
  samples: { digest: string; date: string }[];
};
export type FromMemory = { key: string; question: string; count: number; in: number; out: number; first: string; last: string; value: string; blob: string };
export type Row = {
  date: string; digest: string; label: string; assets_in: string; assets_out: string; counterparty: string; rule_used: string;
  suiscan: string; sui_usd_price: string; usd_value: string; usd_basis: string;
};
export type DrawerRule = { match: string; value: string; blob: string; at: string };
export type DrawerOutcome = { range: string; txs: number; asked: number; answered: number; reused: number; at: string; blob: string };
export type DrawerEvent = { at: string; match: string; kind: "saved" | "updated"; value: string; from?: string; blob: string };
export type DrawerData = { rules: DrawerRule[]; outcomes: DrawerOutcome[]; events: DrawerEvent[]; listed: number; incomplete: boolean; stale: { at: string } | null };

// One answer being saved (or saved, or failed). `filed` = it has flown into the drawer.
export type SaveState = {
  phase: "saving" | "filed" | "error"; step: StepState; value: string; answerId: string; prev?: string; blob?: string; error?: string;
};

// The raw /api/rules response and the import's memory data are normalised into DrawerData in the page.
export type RawRules = {
  rules: { match: string; label?: string; kind?: string }[]; blobs: Record<string, string>; ats: Record<string, string>;
  outcomes: { range: string; txs: number; asked: number; answered: number; reused: number; at: string; blob: string }[];
  events: DrawerEvent[]; listed: number; incomplete: boolean; stale?: { at: string } | null;
};
export const toDrawer = (r: RawRules): DrawerData => ({
  rules: r.rules
    .map((x) => ({ match: x.match, value: x.kind ? `kind:${x.kind}` : `label:${x.label}`, blob: r.blobs[x.match] ?? "", at: r.ats[x.match] ?? "" }))
    .sort((a, b) => (a.at < b.at ? 1 : -1)),
  outcomes: r.outcomes, events: r.events, listed: r.listed, incomplete: r.incomplete, stale: r.stale ?? null,
});
