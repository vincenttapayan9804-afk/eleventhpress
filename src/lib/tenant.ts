/**
 * Whitelabel Phase 1 — hostname -> Tenant resolution.
 *
 * Deliberately reads the raw `host` header directly rather than routing
 * through src/proxy.ts: Caddyfile already forwards the original Host header
 * unmodified to the Next.js process (`header_up Host {host}`), and Vercel
 * does the same, so every Node-runtime route handler already sees the real
 * incoming hostname via `req.headers.get("host")` — no proxy change needed
 * to make it available. Keeping this out of proxy.ts also avoids its
 * documented fragility (see the comment at the top of that file about static
 * generation / nonce/edge constraints); tenant resolution needs a real DB
 * query, which only runs in the Node runtime this module is imported into,
 * not the Edge runtime proxy.ts executes in.
 *
 * Same calling convention as src/lib/auth.ts's getSessionFromHeaders: takes
 * a plain `Headers` object so it works identically from API route handlers
 * (`req.headers`) and, later, from Server Components (`await headers()`
 * from "next/headers").
 */
import { cache } from "react";
import { db } from "./db";
import { APP_BASE_URL, APP_HOST } from "./site";
import { getSessionFromHeaders } from "./auth";

/** Social profiles an organization can list. Keys are fixed so the footer, emails and PDFs know which icon/label to use. */
export const SOCIAL_LINK_KEYS = ["facebook", "x", "linkedin", "instagram", "youtube", "tiktok", "researchgate"] as const;
export type SocialLinkKey = (typeof SOCIAL_LINK_KEYS)[number];
export type SocialLinks = Partial<Record<SocialLinkKey, string>>;

export const SOCIAL_LINK_LABELS: Record<SocialLinkKey, string> = {
  facebook: "Facebook",
  x: "X (Twitter)",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  researchgate: "ResearchGate",
};

export interface TenantBranding {
  siteName: string | null;
  tagline: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  fontFamily: string | null;
  // Organization profile
  officialEmail: string | null;
  supportEmail: string | null;
  phone: string | null;
  phoneAlt: string | null;
  websiteUrl: string | null;
  address: string | null;
  socialLinks: SocialLinks | null;
  // Legal identity (Terms, Privacy, Cookie Policy)
  legalName: string | null;
  legalJurisdiction: string | null;
  privacyEmail: string | null;
}

/**
 * How the request reached its tenant:
 * - "domain": the tenant's own verified hostname (custom domain/subdomain).
 * - "session": the signed-in account belongs to a whitelabel tenant, so the
 *   official site shows that institution's platform to them.
 * - "portal": a visitor opened the tenant's public portal link
 *   (/t/<slug>), which remembers the choice in a cookie.
 * - "platform": the official Eleventh Press site.
 */
export type TenantSource = "domain" | "session" | "portal" | "platform";

export interface TenantContext extends TenantBranding {
  id: string;
  slug: string;
  name: string;
  status: string;
  isPlatform: boolean;
  source: TenantSource;
}

/** Cookie remembering which tenant portal a visitor opened via /t/<slug>. */
export const PORTAL_COOKIE_NAME = "ep_portal";

/** Valid values for Tenant.fontFamily — matches the CSS variables already defined in src/app/layout.tsx. */
export const FONT_FAMILY_OPTIONS = ["inter", "fraunces", "system"] as const;
export type FontFamilyOption = (typeof FONT_FAMILY_OPTIONS)[number];

function normalizeHost(host: string): string {
  // Strip a port suffix ("localhost:3000" -> "localhost") — TenantDomain
  // rows store bare hostnames, and a port is never part of a real public
  // domain/subdomain identity.
  return host.split(":")[0].toLowerCase();
}

/**
 * Resolves a hostname to its Tenant, falling back to the platform tenant
 * (the original eleventhpress.org site) for anything unrecognized —
 * localhost, preview deployment URLs, or a host that hasn't been mapped to
 * a TenantDomain yet. Never throws: in a healthy database, never returns
 * null either, since the platform tenant is guaranteed to exist by
 * scripts/backfill-platform-tenant.ts, which runs on every build; if the
 * database itself is unreachable, fails open to null rather than taking
 * every request down with it — every caller already treats a null tenant
 * as "use the hardcoded default branding" (see layout.tsx's
 * generateMetadata/RootLayout), so this is a real fallback, not a silently
 * broken one.
 */
export async function resolveTenantFromHost(
  hostHeader: string | null | undefined,
  opts: { sessionTenantId?: string | null; portalSlug?: string | null } = {}
): Promise<TenantContext | null> {
  const host = hostHeader ? normalizeHost(hostHeader) : null;
  let platformRow: TenantRow | null = null;

  try {
    if (host) {
      // Only a *verified* domain may resolve traffic to its tenant — an
      // unverified row (added by an admin who hasn't proven DNS control yet,
      // or whose control has never actually been checked) must never route
      // real requests, or anyone could claim a hostname they don't own.
      const domain = await db.tenantDomain.findFirst({
        where: { hostname: host, verified: true },
        include: { tenant: true },
      });
      // The official site's own hostname is a verified domain of the
      // platform tenant. Matching it means "on the official site", not "show
      // the platform": the session and portal checks below must still run,
      // or a whitelabel portal link (/t/<slug>) and a tenant member signed in
      // on the official host would both always see Eleventh Press.
      if (domain && !domain.tenant.isPlatform) return toTenantContext(domain.tenant, "domain");
      if (domain) platformRow = domain.tenant;
    }

    // On the official site: a signed-in member of a whitelabel tenant
    // always works inside their own institution's platform, and a visitor
    // who opened a tenant's portal link sees that tenant. A suspended
    // tenant falls back to the official site.
    if (opts.sessionTenantId) {
      const own = await db.tenant.findUnique({ where: { id: opts.sessionTenantId } });
      if (own && !own.isPlatform && own.status !== "SUSPENDED") return toTenantContext(own, "session");
      // An official-site account viewing no portal: its row is the platform — skip the second lookup.
      if (own?.isPlatform && !opts.portalSlug) return toTenantContext(own, "platform");
    }
    if (opts.portalSlug) {
      const portal = await db.tenant.findUnique({ where: { slug: opts.portalSlug } });
      if (portal && !portal.isPlatform && portal.status === "ACTIVE") return toTenantContext(portal, "portal");
    }

    const platform = platformRow ?? (await db.tenant.findFirst({ where: { isPlatform: true } }));
    return platform ? toTenantContext(platform, "platform") : null;
  } catch (err) {
    console.error("[tenant] resolveTenantFromHost failed, falling back to default branding:", err);
    return null;
  }
}

interface TenantRow {
  id: string;
  slug: string;
  name: string;
  status: string;
  isPlatform: boolean;
  siteName: string | null;
  tagline: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  fontFamily: string | null;
  officialEmail?: string | null;
  supportEmail?: string | null;
  phone?: string | null;
  phoneAlt?: string | null;
  websiteUrl?: string | null;
  address?: string | null;
  socialLinks?: unknown;
  legalName?: string | null;
  legalJurisdiction?: string | null;
  privacyEmail?: string | null;
}

/** Keeps only known social keys with http(s) URLs — the column is free-form JSON. */
export function normalizeSocialLinks(value: unknown): SocialLinks | null {
  if (!value || typeof value !== "object") return null;
  const out: SocialLinks = {};
  for (const key of SOCIAL_LINK_KEYS) {
    const v = (value as Record<string, unknown>)[key];
    if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) out[key] = v.trim();
  }
  return Object.keys(out).length ? out : null;
}

/** The branding/profile subset of a tenant row (what pages, emails and documents use). */
export function brandingOf(tenant: TenantRow | null | undefined): TenantBranding {
  return {
    siteName: tenant?.siteName ?? null,
    tagline: tenant?.tagline ?? null,
    logoUrl: tenant?.logoUrl ?? null,
    faviconUrl: tenant?.faviconUrl ?? null,
    primaryColor: tenant?.primaryColor ?? null,
    accentColor: tenant?.accentColor ?? null,
    fontFamily: tenant?.fontFamily ?? null,
    officialEmail: tenant?.officialEmail ?? null,
    supportEmail: tenant?.supportEmail ?? null,
    phone: tenant?.phone ?? null,
    phoneAlt: tenant?.phoneAlt ?? null,
    websiteUrl: tenant?.websiteUrl ?? null,
    address: tenant?.address ?? null,
    socialLinks: normalizeSocialLinks(tenant?.socialLinks),
    legalName: tenant?.legalName ?? null,
    legalJurisdiction: tenant?.legalJurisdiction ?? null,
    privacyEmail: tenant?.privacyEmail ?? null,
  };
}

export const EMPTY_BRANDING: TenantBranding = brandingOf(null);

function toTenantContext(tenant: TenantRow, source: TenantSource): TenantContext {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    status: tenant.status,
    isPlatform: tenant.isPlatform,
    source: tenant.isPlatform ? "platform" : source,
    ...brandingOf(tenant),
    // A whitelabel tenant that hasn't set a display name yet still shows
    // its own name rather than "Eleventh Press".
    siteName: tenant.siteName ?? (tenant.isPlatform ? null : tenant.name),
  };
}

function cookieValue(headers: Headers, name: string): string | null {
  const raw = headers.get("cookie");
  if (!raw) return null;
  const match = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Headers-object entry point for API route handlers — mirrors getSessionFromHeaders(headers). */
export function resolveTenantFromHeaders(headers: Headers): Promise<TenantContext | null> {
  const session = getSessionFromHeaders(headers);
  return resolveTenantFromHost(headers.get("host"), {
    sessionTenantId: session?.tenantId ?? null,
    portalSlug: cookieValue(headers, PORTAL_COOKIE_NAME),
  });
}

/**
 * Cache-Control for public, tenant-scoped API responses. The CDN cache key
 * is host + URL (not cookies), so a response for a signed-in tenant member
 * or a portal visitor on the official host must never be stored publicly —
 * it would be served to the next official-site visitor, and vice versa. The
 * client tags those requests with `__ws=<slug>` (see api-client.ts), and a
 * tagged request that resolved to a different tenant isn't cached either.
 */
export function tenantCacheControl(req: { url: string }, tenant: TenantContext | null, publicValue: string): string {
  const noStore = "private, no-store";
  if (tenant && (tenant.source === "session" || tenant.source === "portal")) return noStore;
  try {
    const ws = new URL(req.url).searchParams.get("__ws");
    if (ws && ws !== tenant?.slug) return noStore;
  } catch {
    /* relative URL in tests — fall through */
  }
  return publicValue;
}

/**
 * Server Component entry point. Cached per-request (React `cache()`) so
 * multiple components resolving the tenant on the same render only trigger
 * one DB lookup. Not called anywhere yet in Phase 1 (no UI depends on
 * tenant identity yet) — provided now so Phase 2+ can adopt it without
 * re-deriving this resolution logic.
 */
export const getCurrentTenant = cache(async (): Promise<TenantContext | null> => {
  const { headers } = await import("next/headers");
  const headerList = await headers();
  return resolveTenantFromHeaders(headerList);
});

/** Convenience fallback for code that wants "the tenant, or the platform tenant if truly nothing resolves." */
export async function getPlatformTenant(): Promise<TenantContext> {
  const platform = await db.tenant.findFirst({ where: { isPlatform: true } });
  if (!platform) {
    throw new Error(
      `No platform tenant found (host=${APP_HOST}). Run scripts/backfill-platform-tenant.ts --confirm.`
    );
  }
  return toTenantContext(platform, "platform");
}

/**
 * Whitelabel Phase 5 — every tenant needs exactly one Journal to submit
 * manuscripts into (this is what makes Article isolation work: every
 * Article belongs to a Journal via journalId, so scoping Journal by tenant
 * transitively scopes every Article underneath it, with zero changes to
 * Article itself or the ~30 editorial-workflow routes that operate on an
 * already-known articleId).
 *
 * Auto-provisioning here (rather than only at tenant-creation time) is the
 * safety net for tenants that existed before this field did, or any future
 * path that creates a Tenant row without going through
 * /api/admin/tenants — it always returns a usable Journal, never null.
 */
export async function getOrCreateTenantJournal(tenant: { id: string; name: string }) {
  const existing = await db.journal.findFirst({ where: { tenantId: tenant.id } });
  if (existing) return existing;
  return db.journal.create({
    data: { name: tenant.name, tenantId: tenant.id },
  });
}

/**
 * The public base URL a tenant's own pages should be linked and indexed
 * under: its primary verified domain (custom domain or platform subdomain)
 * when it has one, else the platform's own URL. Used for sitemap/robots,
 * RSS links and canonical URLs, so a tenant's custom domain never points
 * search engines back at eleventhpress.org.
 */
export async function tenantBaseUrl(tenantId: string | null | undefined): Promise<string> {
  if (!tenantId) return APP_BASE_URL;
  const domain = await db.tenantDomain
    .findFirst({
      where: { tenantId, verified: true, tenant: { isPlatform: false } },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: { hostname: true },
    })
    .catch(() => null);
  return domain ? `https://${domain.hostname}` : APP_BASE_URL;
}

/**
 * Base URL for links on the current request: the tenant's own verified
 * domain when the visitor reached it there, else the platform's URL.
 */
export async function requestBaseUrl(tenant: TenantContext | null): Promise<string> {
  if (!tenant || tenant.isPlatform || tenant.source !== "domain") return APP_BASE_URL;
  return tenantBaseUrl(tenant.id);
}
