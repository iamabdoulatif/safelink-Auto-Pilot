import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Police unique du site (titres et texte), chargée une fois :
// Space Grotesk, la grotesque du wireframe de référence.
const titres = Space_Grotesk({
  variable: "--font-titres",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SafeLink Auto-Pilot — Parc de routeurs",
  description:
    "Surveillance des routeurs MikroTik : diagnostic matériel, Wi-Fi et audit de configuration.",
};

export const viewport: Viewport = {
  themeColor: "#f3f3f3",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${titres.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
