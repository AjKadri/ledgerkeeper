import { ImageResponse } from "next/og";

export const alt = "LedgerKeeper: label your Sui history for your accountant. Answer each question once.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Link preview for X and LinkedIn (v3 palette): navy night with crisp ledger columns and one flat lit column,
// logo A (light strokes, as in dark mode), the promise, nothing else.
const NAVY = "#1C2533", ON = "#E6ECF2", MUTED = "#A9B6C6", LINE = "rgba(230,236,242,0.11)", MARKER = "#F3D35B", COL = 96;

export default function Image() {
  const cols = Array.from({ length: Math.ceil(1200 / COL) + 1 }, (_, i) => i * COL);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: NAVY, color: ON }}>
        {/* ledger columns: 1px rules, one header rule, one flat lit column */}
        <div style={{ position: "absolute", left: 7 * COL + 1, top: 0, width: COL - 1, height: 630, background: "rgba(243,211,91,0.07)" }} />
        {cols.map((x) => <div key={x} style={{ position: "absolute", left: x, top: 0, width: 1, height: 630, background: LINE }} />)}
        <div style={{ position: "absolute", left: 0, top: 56, width: 1200, height: 1, background: LINE }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: "92px 72px 56px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <svg width="72" height="72" viewBox="0 0 32 32">
              <rect x="6.2" y="12" width="19.6" height="6" fill={MARKER} />
              <rect x="5" y="3" width="22" height="26" rx="3" fill="none" stroke={ON} strokeWidth="2.4" />
              <path d="M9 9h14M9 15h14M9 22h8" fill="none" stroke={ON} strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>LedgerKeeper</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2, maxWidth: 980 }}>Label your Sui history for your accountant.</div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, fontSize: 40, color: MUTED }}>
              <span style={{ borderBottom: `4px solid ${MARKER}`, color: ON, paddingBottom: 2 }}>Answer each question once.</span>
              <span>Your answers live in your Walrus Memory.</span>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: MUTED, borderTop: `1px solid ${LINE}`, paddingTop: 24 }}>
            <span>ledgerkeeper.ajkadri.dev</span>
            <span>Chain data via Tatum · Memory on Walrus</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
