import type { Metadata } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { DOI_REGISTRAR } from "@/lib/site";
import { getCurrentTenant } from "@/lib/tenant";
import { TenantBrandingProvider } from "@/lib/tenant-branding-context";

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

const DEFAULT_TITLE = "Eleventh Press International Publishing — Full-Stack Peer Reviewed Press & Syndication Network";
const DEFAULT_DESCRIPTION = `A Full-Stack Peer Reviewed Press & Multidisciplinary Syndication Network: rigorous peer review, real ${DOI_REGISTRAR} DOIs, genuine open access, and automatic syndication across eight platforms plus a full book-publishing division — one submission, global reach. Indexed via ${DOI_REGISTRAR}, OAI-PMH 2.0, and Google Scholar.`;

/**
 * Dynamic per-tenant metadata (Phase 2). Falls back to the platform's
 * default copy whenever a tenant has no branding override set, so an
 * unbranded tenant (including today's single-tenant deployment) renders
 * byte-for-byte the same <title>/description/favicon it always has.
 */
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  const title = tenant?.siteName
    ? `${tenant.siteName} — ${tenant.tagline || "Powered by Eleventh Press"}`
    : DEFAULT_TITLE;
  const description = tenant?.tagline || DEFAULT_DESCRIPTION;

  return {
    title,
    description,
    keywords: [
      tenant?.siteName || "Eleventh Press",
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
    authors: [{ name: tenant?.siteName || "Eleventh Press International Publishing" }],
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    ...(tenant?.faviconUrl ? { icons: { icon: tenant.faviconUrl } } : {}),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tenant = await getCurrentTenant();
  const branding = {
    siteName: tenant?.siteName ?? null,
    tagline: tenant?.tagline ?? null,
    logoUrl: tenant?.logoUrl ?? null,
    faviconUrl: tenant?.faviconUrl ?? null,
    primaryColor: tenant?.primaryColor ?? null,
    accentColor: tenant?.accentColor ?? null,
    fontFamily: tenant?.fontFamily ?? null,
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Per-tenant color overrides (Phase 2). Values are validated
            server-side against a plain-CSS-color regex before storage (see
            POST /api/admin/tenant-branding), so this interpolation is safe
            from CSS/HTML injection. Emitted as its own <style> tag, after
            globals.css, so it only ever overrides — never redefines — the
            base :root palette. */}
        {(branding.primaryColor || branding.accentColor) && (
          <style
            id="tenant-brand-vars"
            dangerouslySetInnerHTML={{
              __html: `:root{${branding.primaryColor ? `--primary:${branding.primaryColor};` : ""}${
                branding.accentColor ? `--accent:${branding.accentColor};` : ""
              }}`,
            }}
          />
        )}
      </head>
      <body
        data-tenant-font={branding.fontFamily || "inter"}
        className={`${inter.variable} ${fraunces.variable} ${jetbrains.variable} antialiased bg-background text-foreground`}
      >
        {/* Ambient pearlescent background with royal purple tint */}
        <div className="ambient-bg" />
        <div className="ambient-mesh" />
        <TenantBrandingProvider branding={branding}>
          {children}
          <Toaster />
        </TenantBrandingProvider>
      </body>
    </html>
  );
}
