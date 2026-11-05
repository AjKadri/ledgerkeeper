import type { ReactNode } from "react";
import { APP_NAME, DISCLAIMER } from "@/lib/config";

export const metadata = { title: `${APP_NAME}: labelled Sui records, answered once`, description: "Labelling for your accountant, not tax advice." };

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: 900, margin: "0 auto", padding: 12, lineHeight: 1.45 }}>
        <style>{`
          *{box-sizing:border-box} code,td,.wrap{overflow-wrap:anywhere;word-break:break-word}
          input,select,button{max-width:100%;font-size:16px} button{padding:6px 10px;margin:2px 0}
          .box{border:1px solid #ccc;border-radius:6px;padding:12px;margin:12px 0}
          .btns{display:flex;flex-wrap:wrap;gap:6px}
          .tblwrap{overflow-x:auto}
          h1{font-size:26px} h3{font-size:18px}
          @media (max-width:480px){h1{font-size:22px} .box{padding:10px}}
        `}</style>
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
