import type { ReactNode } from "react";
import { APP_NAME, DISCLAIMER } from "@/lib/config";

export const metadata = { title: `${APP_NAME}: labelled Sui records, answered once`, description: "Labelling for your accountant, not tax advice." };

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: 900, margin: "0 auto", padding: 16, lineHeight: 1.45 }}>
        <h1 style={{ marginBottom: 0 }}>{APP_NAME} <small style={{ fontSize: 14, color: "#666" }}>v0.1</small></h1>
        <p style={{ marginTop: 4, color: "#555" }}>Answer each unclear question once; your answers are saved as rules in Walrus Memory and reused.</p>
        {children}
        <hr style={{ marginTop: 32 }} />
        <p style={{ fontSize: 13, color: "#666" }}>
          Labelling for your accountant, not tax advice. History from 23 Jan 2026 only. Chain data via Tatum. Demo memory is visible to the Walrus Memory relayer. {DISCLAIMER}
        </p>
      </body>
    </html>
  );
}
