import { NextRequest, NextResponse } from "next/server";
import { resolveTenantFromHeaders, brandingOf } from "@/lib/tenant";

/**
 * GET /api/tenant/branding
 * Public, unauthenticated — resolves the requesting tenant and returns just
 * its branding and public organization profile (never status/plan/billing,
 * which are internal).
 */
export async function GET(req: NextRequest) {
  const tenant = await resolveTenantFromHeaders(req.headers);
  return NextResponse.json(
    { branding: { ...brandingOf(tenant), siteName: tenant?.siteName ?? null } },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
