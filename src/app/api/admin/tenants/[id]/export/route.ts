import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenantScope } from "@/lib/tenant-auth";
import { TENANT_SCOPED_ADMIN_ROLES } from "@/lib/roles";
import { withRlsContext } from "@/lib/db-rls";

/**
 * GET /api/admin/tenants/[id]/export
 *
 * Whitelabel Phase 5 — a basic compliance/portability export: a JSON dump
 * of everything this codebase currently scopes by tenantId (Users, Books,
 * Magazines, Podcasts, MediaPosts, Collections, and the tenant's Journal
 * with its Articles) for one tenant. SUPER_ADMIN can export any tenant;
 * TENANT_ADMIN can only export their own (requireTenantScope).
 *
 * Deliberately export-only, not delete — a tenant data deletion/purge
 * endpoint needs its own careful cascade design (what happens to a
 * published Article's DOI, a paid Invoice, ...) and is flagged as
 * follow-up work rather than rushed into this pass.
 *
 * User rows are exported without password hashes or OAuth tokens — this is
 * a data-portability export, not a credential dump.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireTenantScope(req.headers, id, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenant = await db.tenant.findUnique({ where: { id } });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const [users, books, magazines, podcasts, mediaPosts, collections, journals] = await withRlsContext(
    auth.session,
    (tx) =>
      Promise.all([
        tx.user.findMany({
          where: { tenantId: id },
          select: {
            id: true, email: true, fullName: true, role: true, affiliation: true, country: true, createdAt: true,
          },
        }),
        tx.book.findMany({ where: { tenantId: id } }),
        tx.magazine.findMany({ where: { tenantId: id } }),
        tx.podcast.findMany({ where: { tenantId: id } }),
        tx.mediaPost.findMany({ where: { tenantId: id } }),
        tx.collection.findMany({ where: { tenantId: id } }),
        tx.journal.findMany({ where: { tenantId: id }, include: { articles: true, issues: true } }),
      ])
  );

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, status: tenant.status, isPlatform: tenant.isPlatform },
    users,
    books,
    magazines,
    podcasts,
    mediaPosts,
    collections,
    journals,
  });
}
