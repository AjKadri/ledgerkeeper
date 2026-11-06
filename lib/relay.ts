// Which relayer paths the same-origin pass-through may forward.
const PATH_OK = /^(health|version|config|api\/[a-z0-9_/-]{1,60}|v1\/[A-Za-z0-9_/-]{1,140})$/;
export const allowedRelayPath = (p: string) => PATH_OK.test(p) && !p.includes("..");
