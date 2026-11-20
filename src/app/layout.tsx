import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import type { Metadata } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { APP_BASE_URL, DOI_REGISTRAR } from "@/lib/site";
import { getCurrentTenant, brandingOf } from "@/lib/tenant";
import { TenantBrandingProvider, type ClientBranding } from "@/lib/tenant-branding-context";
import { brandCssVars } from "@/lib/brand-colors";
import { ThemeProvider } from "@/components/theme-provider";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { ContactDialog } from "@/components/contact/contact-dialog";
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
// Search engines cut titles past ~70 characters and want a meta description
// of 25–160 (Bing flags anything outside that). The long copy above stays on
// the social cards (og/twitter), which have room for it.
const SEARCH_DESCRIPTION = `Peer-reviewed open-access research with real ${DOI_REGISTRAR} DOIs, indexed in Google Scholar and syndicated across eight platforms.`;
const MAX_TITLE = 70;
const MAX_DESCRIPTION = 160;
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:.—-]+$/, "")}…`;
}

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
  // A short tagline alone ("An Enterprise Research Ecosystem") is too thin
  // for a search snippet; the platform site keeps it and adds the full pitch.
  const description = !tenant?.tagline
    ? DEFAULT_DESCRIPTION
    : tenant.isPlatform && tenant.tagline.length < 80
      ? `${tenant.tagline.replace(/[.\s]+$/, "")}. ${DEFAULT_DESCRIPTION}`
      : tenant.tagline;
  // Short forms for the <title> and meta description search engines show.
  const searchTitle = title.length <= MAX_TITLE ? title : tenant?.siteName || clip(title, MAX_TITLE);
  const searchDescription = !tenant?.tagline
    ? SEARCH_DESCRIPTION
    : tenant.isPlatform && tenant.tagline.length < 80
      ? clip(`${tenant.tagline.replace(/[.\s]+$/, "")}. ${SEARCH_DESCRIPTION}`, MAX_DESCRIPTION)
      : clip(tenant.tagline, MAX_DESCRIPTION);
  // Home-screen icon: a whitelabel tenant's own logo/initials (src/app/pwa-icon).
  const appleIcon = tenant && !tenant.isPlatform ? `/pwa-icon/180?t=${encodeURIComponent(tenant.slug)}` : "/pwa-icon/180";

  const siteName = tenant?.siteName || "Eleventh Press International Publishing™";
  // Search Console / Bing Webmaster ownership tags, set per deployment.
  const google = process.env.GOOGLE_SITE_VERIFICATION?.split(",").map((v) => v.trim()).filter(Boolean);
  const bing = process.env.BING_SITE_VERIFICATION?.trim();

  return {
    metadataBase: new URL(APP_BASE_URL),
    title: searchTitle,
    description: searchDescription,
    applicationName: siteName,
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large", "max-video-preview": -1 },
    },
    ...(google?.length || bing
      ? { verification: { ...(google?.length ? { google } : {}), ...(bing ? { other: { "msvalidate.01": bing } } : {}) } }
      : {}),
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
      siteName,
      locale: "en_US",
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
            <ContactDialog />
            <UiSoundEffects />
            <ServiceWorkerRegister />
          </TenantBrandingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
