import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Police des titres, chargée une fois pour tout le site.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SafeLink Auto-Pilot — Parc de routeurs",
  description:
    "Surveillance des routeurs MikroTik : diagnostic matériel, Wi-Fi et audit de configuration.",
};

export const viewport: Viewport = {
  themeColor: "#f4efe3",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
