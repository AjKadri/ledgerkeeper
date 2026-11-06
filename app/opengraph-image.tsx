import { ImageResponse } from "next/og";

export const alt = "LedgerKeeper: label your Sui history for your accountant. Answer each question once.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Link preview for X and LinkedIn: the mark, the promise, nothing else.
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#F4F6F8", padding: 72, color: "#1C2533" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 32 32">
            <rect x="6.2" y="12" width="19.6" height="6" fill="#F3D35B" />
            <rect x="5" y="3" width="22" height="26" rx="3" fill="none" stroke="#1C2533" strokeWidth="2.4" />
            <path d="M9 9h14M9 15h14M9 22h8" fill="none" stroke="#1C2533" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>LedgerKeeper</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2, maxWidth: 980 }}>Label your Sui history for your accountant.</div>
          <div style={{ fontSize: 40, color: "#4F5D70", maxWidth: 980 }}>Answer each question once. Your answers live in your Walrus Memory.</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: "#4F5D70", borderTop: "2px solid #CBD6E2", paddingTop: 24 }}>
          <span>ledgerkeeper.vercel.app</span>
          <span>Chain data via Tatum · Memory on Walrus</span>
        </div>
      </div>
    ),
    size,
  );
}
