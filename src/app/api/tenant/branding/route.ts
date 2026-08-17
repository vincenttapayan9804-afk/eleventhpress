import { NextRequest, NextResponse } from "next/server";
import { resolveTenantFromHeaders, type TenantBranding } from "@/lib/tenant";

/**
 * GET /api/tenant/branding
 * Public, unauthenticated — resolves the requesting tenant from the Host
 * header and returns just its branding fields (never id/status/isPlatform,
 * which are internal). Consumed client-side by TenantBrandingProvider so
 * every already-rendered page picks up per-tenant branding without needing
 * a server round-trip tied to auth state.
 */
export async function GET(req: NextRequest) {
  const tenant = await resolveTenantFromHeaders(req.headers);
  const branding: TenantBranding = tenant
    ? {
        siteName: tenant.siteName,
        tagline: tenant.tagline,
        logoUrl: tenant.logoUrl,
        faviconUrl: tenant.faviconUrl,
        primaryColor: tenant.primaryColor,
        accentColor: tenant.accentColor,
        fontFamily: tenant.fontFamily,
      }
    : {
        siteName: null,
        tagline: null,
        logoUrl: null,
        faviconUrl: null,
        primaryColor: null,
        accentColor: null,
        fontFamily: null,
      };
  return NextResponse.json({ branding });
}
