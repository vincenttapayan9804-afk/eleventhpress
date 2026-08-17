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
import { APP_HOST } from "./site";

export interface TenantBranding {
  siteName: string | null;
  tagline: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  fontFamily: string | null;
}

export interface TenantContext extends TenantBranding {
  id: string;
  slug: string;
  name: string;
  status: string;
  isPlatform: boolean;
}

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
 * a TenantDomain yet. Never throws and never returns null in a healthy
 * database: the platform tenant is guaranteed to exist by
 * scripts/backfill-platform-tenant.ts, which runs on every build.
 */
export async function resolveTenantFromHost(hostHeader: string | null | undefined): Promise<TenantContext | null> {
  const host = hostHeader ? normalizeHost(hostHeader) : null;

  if (host) {
    // Only a *verified* domain may resolve traffic to its tenant — an
    // unverified row (added by an admin who hasn't proven DNS control yet,
    // or whose control has never actually been checked) must never route
    // real requests, or anyone could claim a hostname they don't own.
    const domain = await db.tenantDomain.findFirst({
      where: { hostname: host, verified: true },
      include: { tenant: true },
    });
    if (domain) return toTenantContext(domain.tenant);
  }

  const platform = await db.tenant.findFirst({ where: { isPlatform: true } });
  return platform ? toTenantContext(platform) : null;
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
}

function toTenantContext(tenant: TenantRow): TenantContext {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    status: tenant.status,
    isPlatform: tenant.isPlatform,
    siteName: tenant.siteName,
    tagline: tenant.tagline,
    logoUrl: tenant.logoUrl,
    faviconUrl: tenant.faviconUrl,
    primaryColor: tenant.primaryColor,
    accentColor: tenant.accentColor,
    fontFamily: tenant.fontFamily,
  };
}

/** Headers-object entry point for API route handlers — mirrors getSessionFromHeaders(headers). */
export function resolveTenantFromHeaders(headers: Headers): Promise<TenantContext | null> {
  return resolveTenantFromHost(headers.get("host"));
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
  return resolveTenantFromHost(headerList.get("host"));
});

/** Convenience fallback for code that wants "the tenant, or the platform tenant if truly nothing resolves." */
export async function getPlatformTenant(): Promise<TenantContext> {
  const platform = await db.tenant.findFirst({ where: { isPlatform: true } });
  if (!platform) {
    throw new Error(
      `No platform tenant found (host=${APP_HOST}). Run scripts/backfill-platform-tenant.ts --confirm.`
    );
  }
  return toTenantContext(platform);
}
