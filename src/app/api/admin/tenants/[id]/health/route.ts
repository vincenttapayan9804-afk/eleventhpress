import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenantScope } from "@/lib/tenant-auth";
import { TENANT_SCOPED_ADMIN_ROLES } from "@/lib/roles";
import { withRlsContext } from "@/lib/db-rls";

/**
 * GET /api/admin/tenants/[id]/health
 *
 * Whitelabel Phase 6 — a single at-a-glance status view for one tenant:
 * content/user volumes, seat quota usage, and domain provisioning state.
 * SUPER_ADMIN can view any tenant; TENANT_ADMIN only their own
 * (requireTenantScope, same gate as the export endpoint).
 *
 * Deliberately a JSON endpoint, not a UI page — no admin dashboard page
 * exists yet for any tenant-management feature in this codebase (tenant
 * CRUD, branding, domains, export are all API-only so far), so a
 * standalone health *page* would be a scope departure from every prior
 * phase rather than an extension of one. Building that UI is flagged as
 * follow-up work, not done here.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireTenantScope(req.headers, id, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenant = await db.tenant.findUnique({
    where: { id },
    include: { domains: { orderBy: { createdAt: "asc" } } },
  });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const [userCount, bookCount, magazineCount, podcastCount, mediaPostCount, collectionCount, journal] =
    await withRlsContext(auth.session, (tx) =>
      Promise.all([
        tx.user.count({ where: { tenantId: id } }),
        tx.book.count({ where: { tenantId: id } }),
        tx.magazine.count({ where: { tenantId: id } }),
        tx.podcast.count({ where: { tenantId: id } }),
        tx.mediaPost.count({ where: { tenantId: id } }),
        tx.collection.count({ where: { tenantId: id } }),
        tx.journal.findFirst({ where: { tenantId: id }, include: { _count: { select: { articles: true, issues: true } } } }),
      ])
    );

  return NextResponse.json({
    tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, status: tenant.status, isPlatform: tenant.isPlatform },
    quota: {
      maxUsers: tenant.maxUsers,
      userCount,
      // null maxUsers means unlimited — no meaningful percentage to report.
      usagePercent: tenant.maxUsers ? Math.round((userCount / tenant.maxUsers) * 100) : null,
    },
    content: {
      books: bookCount,
      magazines: magazineCount,
      podcasts: podcastCount,
      mediaPosts: mediaPostCount,
      collections: collectionCount,
      articles: journal?._count.articles ?? 0,
      issues: journal?._count.issues ?? 0,
    },
    domains: tenant.domains.map((d) => ({
      hostname: d.hostname,
      isPrimary: d.isPrimary,
      verified: d.verified,
      vercelAdded: d.vercelAdded,
    })),
  });
}
