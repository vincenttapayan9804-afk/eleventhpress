import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireTenantScope } from "@/lib/tenant-auth";
import { TENANT_SCOPED_ADMIN_ROLES } from "@/lib/roles";
import { parseBody } from "@/lib/validate";

const UpdateTenantSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "PROVISIONING"]).optional(),
  // Whitelabel Phase 6 — null explicitly clears the cap (unlimited);
  // omitted leaves it unchanged. A platform-level plan/billing decision,
  // so — like `status` below — only SUPER_ADMIN may set it.
  maxUsers: z.number().int().min(0).nullable().optional(),
});

/**
 * TENANT_ADMIN may rename their own tenant but never change `status` or
 * `maxUsers` (moderation/plan decisions are platform-level actions) —
 * enforced by simply stripping those fields before they reach Prisma,
 * rather than trusting the caller not to send them.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireTenantScope(req.headers, id, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseBody(req, UpdateTenantSchema);
  if (!parsed.ok) return parsed.response;

  const tenant = await db.tenant.findUnique({ where: { id } });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const data = { ...parsed.data };
  if (auth.session.role !== "SUPER_ADMIN") {
    delete data.status;
    delete data.maxUsers;
  }

  const updated = await db.tenant.update({ where: { id }, data });
  return NextResponse.json({
    tenant: { id: updated.id, slug: updated.slug, name: updated.name, status: updated.status, isPlatform: updated.isPlatform, maxUsers: updated.maxUsers },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const tenant = await db.tenant.findUnique({
    where: { id },
    include: { _count: { select: { domains: true, users: true } } },
  });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  if (tenant.isPlatform) {
    return NextResponse.json({ error: "Cannot delete the platform tenant" }, { status: 400 });
  }
  if (tenant._count.users > 0) {
    return NextResponse.json({ error: `Tenant has ${tenant._count.users} user(s) — reassign or remove them first` }, { status: 400 });
  }
  if (tenant._count.domains > 0) {
    return NextResponse.json({ error: "Remove all domains from this tenant before deleting it" }, { status: 400 });
  }
  // Whitelabel Phase 6 — tenantId on Book/Magazine/Podcast/MediaPost/
  // Collection/Journal is a plain scalar, not an enforced foreign key (see
  // that field's doc comment on Book), so deleting a tenant that still owns
  // content wouldn't fail loudly — it would silently orphan those rows with
  // a tenantId that no longer resolves to anything. Block it here instead;
  // /api/admin/tenants/[id]/purge is the endpoint for tenants that do have
  // content to clean up.
  const [bookCount, magazineCount, podcastCount, mediaPostCount, collectionCount, journalCount] = await Promise.all([
    db.book.count({ where: { tenantId: id } }),
    db.magazine.count({ where: { tenantId: id } }),
    db.podcast.count({ where: { tenantId: id } }),
    db.mediaPost.count({ where: { tenantId: id } }),
    db.collection.count({ where: { tenantId: id } }),
    db.journal.count({ where: { tenantId: id } }),
  ]);
  const contentCount = bookCount + magazineCount + podcastCount + mediaPostCount + collectionCount + journalCount;
  if (contentCount > 0) {
    return NextResponse.json(
      { error: `Tenant still has ${contentCount} content record(s) — use /api/admin/tenants/${id}/purge or remove them first` },
      { status: 400 }
    );
  }

  await db.tenant.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
