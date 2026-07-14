import type { Metadata } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { DOI_REGISTRAR } from "@/lib/site";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const fraunces = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Eleventh Press International Publishing — Full-Stack Peer Reviewed Press & Syndication Network",
  description:
    `A Full-Stack Peer Reviewed Press & Multidisciplinary Syndication Network: rigorous peer review, real ${DOI_REGISTRAR} DOIs, genuine open access, and automatic syndication across eight platforms plus a full book-publishing division — one submission, global reach. Indexed via ${DOI_REGISTRAR}, OAI-PMH 2.0, and Google Scholar.`,
  keywords: [
    "Eleventh Press",
    "open access journal",
    "multidisciplinary research",
    "peer review",
    `${DOI_REGISTRAR} DOI`,
    "OAI-PMH",
    "academic publishing",
    "syndication network",
    "book publishing",
    "preprint distribution",
  ],
  authors: [{ name: "Eleventh Press International Publishing" }],
  openGraph: {
    title: "Eleventh Press International Publishing — A Full-Stack Peer Reviewed Press & Multidisciplinary Syndication Network",
    description:
      "Peer review, real DOIs, genuine open access, and automatic syndication across eight platforms plus book publishing — from one submission.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Eleventh Press International Publishing",
    description: "A Full-Stack Peer Reviewed Press & Multidisciplinary Syndication Network.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${fraunces.variable} ${jetbrains.variable} antialiased bg-background text-foreground`}
      >
        {/* Ambient pearlescent background with royal purple tint */}
        <div className="ambient-bg" />
        <div className="ambient-mesh" />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
