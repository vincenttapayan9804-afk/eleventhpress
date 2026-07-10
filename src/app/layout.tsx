import type { Metadata } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

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
  title: "Eleventh Press International Publishing — Academic Luxury",
  description:
    "A peer-reviewed, open-access multidisciplinary journal of uncompromising editorial rigor. Royal purple prestige meets pearlescent clarity. Indexed via Crossref, OAI-PMH 2.0, and Google Scholar.",
  keywords: [
    "Eleventh Press",
    "open access journal",
    "multidisciplinary research",
    "peer review",
    "Crossref DOI",
    "OAI-PMH",
    "academic publishing",
  ],
  authors: [{ name: "Eleventh Press International Publishing" }],
  openGraph: {
    title: "Eleventh Press International Publishing",
    description:
      "Peer-reviewed, open-access multidisciplinary journal. Academic luxury design language.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Eleventh Press International Publishing",
    description: "Peer-reviewed, open-access multidisciplinary journal.",
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
