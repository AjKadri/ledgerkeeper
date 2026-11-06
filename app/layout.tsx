import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk, JetBrains_Mono } from "next/font/google";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

const ui = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: `${APP_NAME}: labelled Sui records, answered once`,
  description: "Label your Sui history for your accountant. Answer each question once; your answers live in your Walrus Memory.",
  metadataBase: new URL("https://ledgerkeeper.ajkadri.dev"),
  openGraph: {
    title: `${APP_NAME}: labelled Sui records, answered once`,
    description: "Label your Sui history for your accountant. Answer each question once.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F6F8" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1620" },
  ],
};

// Applies a saved theme before paint, so there is no flash. Without a saved choice the system setting decides.
const themeScript = `try{var t=localStorage.getItem("lk-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
