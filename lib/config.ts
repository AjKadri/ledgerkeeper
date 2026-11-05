// Single place for the product name. Ask the user before changing it.
export const APP_NAME = "LedgerKeeper";
export const DISCLAIMER = "Not affiliated with Ledger SAS.";
// Tatum's Sui history starts here; anything earlier is unavailable.
export const HISTORY_START = "2026-01-23";
export const HISTORY_START_CHECKPOINT = 237661233;

// Labels an answer may use.
export const ANSWER_LABELS = [
  "own_wallet_transfer", "exchange_deposit", "exchange_withdrawal", "payment_received", "payment_sent",
  "swap", "lp_add", "lp_remove", "lp_compound", "reward_claim", "ignore",
] as const;

// Demo wallet (public wallet, fictional owner) and its two-import date split.
export const DEMO_WALLET = "0xfee42d20b4616a1c11b1361361404dac42442b5d9be275521dba05d84a7e1342";
export const IMPORT_SPLIT = { import1: { to: "2026-06-30" }, import2: { from: "2026-07-01", to: "2026-08-31" } };

export const NAMESPACE_RE = /^lk-[a-f0-9]{12,32}$/;
export const ADDRESS_RE = /^0x[0-9a-fA-F]{64}$/;
