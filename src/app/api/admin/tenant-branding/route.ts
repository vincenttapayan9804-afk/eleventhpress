import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseBody } from "@/lib/validate";
import { BrandingSchema, brandingFormOf, resolveBrandingTarget } from "@/lib/tenant-branding-admin";

/**
 * GET/PUT /api/admin/tenant-branding[?tenantId=]
 * The branding console's API: logo, favicon, colours, font, and the
 * organization profile (official/support email, phones, website, address,
 * social links). SUPER_ADMIN may edit any tenant (`?tenantId=`, or the
 * official site by default); TENANT_ADMIN only its own institution.
 */
export async function GET(req: NextRequest) {
  const target = await resolveBrandingTarget(req);
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });
  const t = target.tenant;
  return NextResponse.json({
    tenant: { id: t.id, slug: t.slug, name: t.name, isPlatform: t.isPlatform },
    branding: brandingFormOf(t),
  });
}

export async function PUT(req: NextRequest) {
  const target = await resolveBrandingTarget(req);
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });

  const parsed = await parseBody(req, BrandingSchema);
  if (!parsed.ok) return parsed.response;

  const { socialLinks, ...rest } = parsed.data;
  const data: Prisma.TenantUpdateInput = { ...rest };
  if (socialLinks !== undefined) data.socialLinks = socialLinks === null ? Prisma.DbNull : socialLinks;

  const updated = await db.tenant.update({ where: { id: target.tenant.id }, data });

  await db.auditLog
    .create({
      data: {
        userId: target.session.userId,
        action: "TENANT_BRANDING_UPDATED",
        entityType: "TENANT",
        entityId: updated.id,
        metadata: JSON.stringify({ fields: Object.keys(parsed.data) }),
      },
    })
    .catch(() => {});

  return NextResponse.json({ branding: brandingFormOf(updated) });
}
