import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Self-hosted by Next at build time — no runtime CDN calls (offline-safe).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "FlowState — Restore your context, instantly",
  description:
    "A privacy-first, fully offline context restorer for technical workflows. Ground-truth capture, local AI, zero data leaves your machine.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="font-sans antialiased bg-ink-950 text-slate-200 selection:bg-flow-400/30">
        {children}
      </body>
    </html>
  );
}
