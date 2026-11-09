// Errors the user should see as-is (bad input, switched-off writes). Everything else is shown generically.
export class UserError extends Error {
  // Optional machine-readable reason, sent next to the message (additive; the message text is unchanged).
  constructor(message?: string, public reason?: string) { super(message); }
}
// The wallet holds funds but has no activity since HISTORY_START.
export const NO_RECENT_ACTIVITY = "no_recent_activity";
