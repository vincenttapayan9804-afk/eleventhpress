import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import type { Metadata } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { DOI_REGISTRAR } from "@/lib/site";
import { getCurrentTenant, brandingOf } from "@/lib/tenant";
import { TenantBrandingProvider, type ClientBranding } from "@/lib/tenant-branding-context";
import { brandCssVars } from "@/lib/brand-colors";
import { ThemeProvider } from "@/components/theme-provider";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { UiSoundEffects } from "@/components/ui-sound";
import { POWERED_BY_CREDIT } from "@/lib/powered-by";

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

const DEFAULT_TITLE = "Eleventh Press International Publishing™ — Full-Stack Peer Reviewed Press & Syndication Network";
const DEFAULT_DESCRIPTION = `A Full-Stack Peer Reviewed Press & Multidisciplinary Syndication Network: rigorous peer review, real ${DOI_REGISTRAR} DOIs, genuine open access, and automatic syndication across eight platforms plus a full book-publishing division — one submission, global reach. Indexed via ${DOI_REGISTRAR}, OAI-PMH 2.0, and Google Scholar.`;

/**
 * Dynamic per-tenant metadata (Phase 2). Falls back to the platform's
 * default copy whenever a tenant has no branding override set, so an
 * unbranded tenant (including today's single-tenant deployment) renders
 * byte-for-byte the same <title>/description/favicon it always has.
 */
export const viewport = { themeColor: "#3b1466" };

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  const title = tenant?.siteName
    ? `${tenant.siteName} — ${tenant.tagline || POWERED_BY_CREDIT}`
    : DEFAULT_TITLE;
  const description = tenant?.tagline || DEFAULT_DESCRIPTION;
  // Home-screen icon: a whitelabel tenant's own logo/initials (src/app/pwa-icon).
  const appleIcon = tenant && !tenant.isPlatform ? `/pwa-icon/180?t=${encodeURIComponent(tenant.slug)}` : "/pwa-icon/180";

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
    authors: [{ name: tenant?.siteName || "Eleventh Press International Publishing™" }],
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
    alternates: {
      types: { "application/rss+xml": "/api/feed/articles.xml" },
    },
    ...(tenant?.faviconUrl || (tenant && !tenant.isPlatform && tenant.logoUrl)
      ? { icons: { icon: (tenant.faviconUrl || tenant.logoUrl)!, apple: appleIcon } }
      : { icons: { apple: appleIcon } }),
    appleWebApp: { capable: true, title, statusBarStyle: "default" },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tenant = await getCurrentTenant();
  const branding: ClientBranding = {
    ...brandingOf(tenant),
    siteName: tenant?.siteName ?? null,
    tenantId: tenant?.id ?? null,
    tenantSlug: tenant?.slug ?? null,
    tenantName: tenant?.name ?? null,
    isPlatform: tenant?.isPlatform ?? true,
    source: tenant?.source ?? "platform",
  };
  const brandCss = brandCssVars(branding.primaryColor, branding.accentColor);
  // Requests made from a tenant platform reached through the official host
  // (signed-in member or portal visitor) carry this slug so the CDN never
  // serves them the official site's cached responses (see api-client.ts).
  const workspaceTag = tenant && !tenant.isPlatform && tenant.source !== "domain" ? tenant.slug : undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Per-tenant color overrides (Phase 2). Values are validated
            server-side against a plain-CSS-color regex before storage (see
            POST /api/admin/tenant-branding), so this interpolation is safe
            from CSS/HTML injection. Emitted as its own <style> tag, after
            globals.css, so it only ever overrides — never redefines — the
            base :root palette. */}
        {brandCss ? <style id="tenant-brand-vars" dangerouslySetInnerHTML={{ __html: brandCss }} /> : null}
      </head>
      <body
        data-tenant-font={branding.fontFamily || "inter"}
        data-tenant-id={branding.tenantId ?? undefined}
        data-ws={workspaceTag}
        data-ws-source={branding.source}
        className={`${inter.variable} ${fraunces.variable} ${jetbrains.variable} antialiased bg-background text-foreground`}
      >
        {/* Ambient pearlescent background with royal purple tint */}
        <div className="ambient-bg" />
        <div className="ambient-mesh" />
        <ThemeProvider>
          <TenantBrandingProvider branding={branding}>
            {children}
            <Toaster />
            <CookieConsentBanner />
            <UiSoundEffects />
            <ServiceWorkerRegister />
          </TenantBrandingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
