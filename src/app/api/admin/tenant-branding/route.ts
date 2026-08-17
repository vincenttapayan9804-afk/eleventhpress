import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenantScope } from "@/lib/tenant-auth";
import { TENANT_SCOPED_ADMIN_ROLES } from "@/lib/roles";
import { resolveTenantFromHeaders, FONT_FAMILY_OPTIONS } from "@/lib/tenant";
import { parseBody } from "@/lib/validate";

/**
 * GET/PUT /api/admin/tenant-branding
 * Operates on whichever tenant the request's Host header resolves to (same
 * resolution every public page uses). SUPER_ADMIN may edit any tenant's
 * branding this way; TENANT_ADMIN may only edit branding while the request
 * is being made from their own tenant's domain (requireTenantScope below).
 */

// Deliberately restrictive — this value is interpolated into a raw <style>
// block in the root layout (see resolveTenantFromHost -> layout.tsx), so it
// must never be able to contain "}" / "<" / etc. and break out of the CSS
// custom-property declaration. Covers hex, rgb()/oklch()/hsl() functions,
// and CSS named colors.
const CSS_COLOR_RE = /^[a-zA-Z0-9#(),.%\s-]+$/;
const CssColor = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(CSS_COLOR_RE, "Must be a plain CSS color (hex, rgb(), oklch(), etc.)");

const BrandingSchema = z.object({
  siteName: z.string().trim().max(200).nullable().optional(),
  tagline: z.string().trim().max(300).nullable().optional(),
  logoUrl: z.string().trim().url().max(2000).nullable().optional().or(z.literal("").transform(() => null)),
  faviconUrl: z.string().trim().url().max(2000).nullable().optional().or(z.literal("").transform(() => null)),
  primaryColor: CssColor.nullable().optional(),
  accentColor: CssColor.nullable().optional(),
  fontFamily: z.enum(FONT_FAMILY_OPTIONS).nullable().optional(),
});

export async function GET(req: NextRequest) {
  const tenant = await resolveTenantFromHeaders(req.headers);
  if (!tenant) {
    return NextResponse.json({ error: "No tenant resolved for this request" }, { status: 404 });
  }

  const auth = requireTenantScope(req.headers, tenant.id, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json({
    tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
    branding: {
      siteName: tenant.siteName,
      tagline: tenant.tagline,
      logoUrl: tenant.logoUrl,
      faviconUrl: tenant.faviconUrl,
      primaryColor: tenant.primaryColor,
      accentColor: tenant.accentColor,
      fontFamily: tenant.fontFamily,
    },
  });
}

export async function PUT(req: NextRequest) {
  const tenant = await resolveTenantFromHeaders(req.headers);
  if (!tenant) {
    return NextResponse.json({ error: "No tenant resolved for this request" }, { status: 404 });
  }

  const auth = requireTenantScope(req.headers, tenant.id, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const parsed = await parseBody(req, BrandingSchema);
  if (!parsed.ok) return parsed.response;

  const updated = await db.tenant.update({
    where: { id: tenant.id },
    data: parsed.data,
  });

  return NextResponse.json({
    branding: {
      siteName: updated.siteName,
      tagline: updated.tagline,
      logoUrl: updated.logoUrl,
      faviconUrl: updated.faviconUrl,
      primaryColor: updated.primaryColor,
      accentColor: updated.accentColor,
      fontFamily: updated.fontFamily,
    },
  });
}
