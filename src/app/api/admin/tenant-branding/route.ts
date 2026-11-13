import { after, NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseBody } from "@/lib/validate";
import { BrandingUpdateSchema, brandingFormOf, journalFormOf, resolveBrandingTarget } from "@/lib/tenant-branding-admin";
import { getOrCreateTenantJournal } from "@/lib/tenant";
import { PLATFORM_PUBLISHER_NAME } from "@/lib/publisher-identity";
import { refreshTenantGalleys } from "@/lib/tenant-document-refresh";

export const maxDuration = 60;

/** Tenant fields that are printed on generated article galleys. */
const GALLEY_FIELDS = ["siteName", "name", "logoUrl", "primaryColor", "accentColor"] as const;

/**
 * GET/PUT /api/admin/tenant-branding[?tenantId=]
 * The branding console's API: logo, favicon, colours, font, and the
 * organization profile (official/support email, phones, website, address,
 * social links), plus — for a whitelabel tenant — its journal &
 * publication details (title, abbreviation, publisher, ISSNs, description,
 * aims & scope). The official site's journal identity is fixed in
 * src/lib/site.ts and is not editable here. SUPER_ADMIN may edit any tenant (`?tenantId=`, or the
 * official site by default); TENANT_ADMIN only its own institution.
 */
export async function GET(req: NextRequest) {
  const target = await resolveBrandingTarget(req);
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });
  const t = target.tenant;
  const journal = t.isPlatform ? null : await getOrCreateTenantJournal(t).catch(() => null);
  return NextResponse.json({
    tenant: { id: t.id, slug: t.slug, name: t.name, isPlatform: t.isPlatform },
    branding: brandingFormOf(t),
    journal: journalFormOf(journal),
  });
}

export async function PUT(req: NextRequest) {
  const target = await resolveBrandingTarget(req);
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });

  const parsed = await parseBody(req, BrandingUpdateSchema);
  if (!parsed.ok) return parsed.response;

  const { socialLinks, journal: journalInput, ...rest } = parsed.data;
  const data: Prisma.TenantUpdateInput = { ...rest };
  if (socialLinks !== undefined) data.socialLinks = socialLinks === null ? Prisma.DbNull : socialLinks;

  if (journalInput && target.tenant.isPlatform) {
    return NextResponse.json({ error: "The official site's journal details are fixed and can't be edited here." }, { status: 400 });
  }

  const updated = await db.tenant.update({ where: { id: target.tenant.id }, data });

  let journal: Parameters<typeof journalFormOf>[0] = null;
  if (!updated.isPlatform) {
    const current = await getOrCreateTenantJournal(updated);
    if (journalInput) {
      const { name, publisher, ...jrest } = journalInput;
      const jdata: Prisma.JournalUpdateInput = { ...jrest };
      // Name can't be blank: clearing it falls back to the institution's display name.
      if (name !== undefined) jdata.name = name ?? (updated.siteName || updated.name);
      // Publisher is a required column; "blank" stores the platform default,
      // which publisher-identity reads as "use the tenant's own name".
      if (publisher !== undefined) jdata.publisher = publisher ?? PLATFORM_PUBLISHER_NAME;
      journal = await db.journal.update({ where: { id: current.id }, data: jdata });
    } else {
      journal = current;
    }
  }

  // Published galleys print the name, logo, colours and journal details —
  // re-render them in the background so existing PDFs match the new brand.
  const brandChanged = GALLEY_FIELDS.some((k) => (target.tenant[k] ?? null) !== (updated[k] ?? null));
  if (!updated.isPlatform && (brandChanged || journalInput)) {
    const tenantId = updated.id;
    after(() =>
      refreshTenantGalleys(tenantId).catch((e) => console.error("[tenant-branding] galley refresh failed", e))
    );
  }

  await db.auditLog
    .create({
      data: {
        userId: target.session.userId,
        action: "TENANT_BRANDING_UPDATED",
        entityType: "TENANT",
        entityId: updated.id,
        metadata: JSON.stringify({ fields: Object.keys(parsed.data), journalFields: journalInput ? Object.keys(journalInput) : [] }),
      },
    })
    .catch(() => {});

  return NextResponse.json({ branding: brandingFormOf(updated), journal: journalFormOf(journal) });
}
