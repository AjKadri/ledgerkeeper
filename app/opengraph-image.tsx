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
            <rect x="2" y="2" width="28" height="28" rx="6" fill="#1C2533" />
            <rect x="7" y="9" width="18" height="15" rx="2" fill="#F4F6F8" />
            <path d="M7 12.5h18" stroke="#1C2533" strokeWidth="1.6" />
            <path d="M12 18.6l2.6 2.4 5-5.2" fill="none" stroke="#2E6B4F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
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
