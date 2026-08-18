import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { TENANT_SCOPED_ADMIN_ROLES } from "@/lib/roles";
import { withRlsContext } from "@/lib/db-rls";

/**
 * GET /api/admin/rankings/departments
 * EP University OS Phase 5 — comparative research dashboard within a
 * tenant: same TENANT_SCOPED_ADMIN_ROLES + tenantId-resolution shape as
 * GET /api/admin/departments (TENANT_ADMIN confined to its own tenant,
 * SUPER_ADMIN may pass ?tenantId= or omit it for a platform-wide view).
 *
 * Computed live from PUBLISHED Article rows, grouped by the corresponding
 * author's Department (Phase 1's User.departmentId) — no new schema.
 * Articles whose corresponding author has no department (or no
 * corresponding author on file) are bucketed under a synthetic
 * "Unassigned" row (departmentId: null) rather than silently dropped, so
 * the totals stay honest against the tenant's real published-article
 * count.
 */
export async function GET(req: NextRequest) {
  const auth = requireRole(req.headers, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  const requestedTenantId = req.nextUrl.searchParams.get("tenantId") ?? undefined;
  let tenantId: string | undefined;
  if (session.role === "TENANT_ADMIN") {
    tenantId = session.tenantId ?? undefined;
  } else {
    tenantId = requestedTenantId; // SUPER_ADMIN: omitted = every tenant
  }

  const { departments, articles } = await withRlsContext(session, async (tx) => {
    const departments = await tx.department.findMany({
      where: tenantId ? { tenantId } : {},
      select: { id: true, name: true, slug: true, tenantId: true },
      orderBy: { name: "asc" },
    });
    const articles = await tx.article.findMany({
      where: {
        status: "PUBLISHED",
        ...(tenantId ? { journal: { tenantId } } : {}),
      },
      select: {
        views: true,
        downloads: true,
        shares: true,
        citations: true,
        author: { select: { departmentId: true } },
      },
    });
    return { departments, articles };
  });

  const totals = new Map<
    string | null,
    { articles: number; views: number; downloads: number; shares: number; citations: number }
  >();
  for (const a of articles) {
    const deptId = a.author?.departmentId ?? null;
    const t = totals.get(deptId) || { articles: 0, views: 0, downloads: 0, shares: 0, citations: 0 };
    t.articles += 1;
    t.views += a.views;
    t.downloads += a.downloads;
    t.shares += a.shares;
    t.citations += a.citations;
    totals.set(deptId, t);
  }

  const rows = departments.map((d) => {
    const stats = totals.get(d.id) || { articles: 0, views: 0, downloads: 0, shares: 0, citations: 0 };
    return {
      departmentId: d.id,
      name: d.name,
      slug: d.slug,
      tenantId: d.tenantId,
      articleCount: stats.articles,
      totalViews: stats.views,
      totalDownloads: stats.downloads,
      totalShares: stats.shares,
      totalCitations: stats.citations,
      avgCitationsPerArticle: stats.articles > 0 ? Math.round((stats.citations / stats.articles) * 100) / 100 : 0,
    };
  });

  const unassigned = totals.get(null);
  if (unassigned) {
    rows.push({
      departmentId: null as any,
      name: "Unassigned",
      slug: "",
      tenantId: (tenantId ?? null) as any,
      articleCount: unassigned.articles,
      totalViews: unassigned.views,
      totalDownloads: unassigned.downloads,
      totalShares: unassigned.shares,
      totalCitations: unassigned.citations,
      avgCitationsPerArticle: unassigned.articles > 0 ? Math.round((unassigned.citations / unassigned.articles) * 100) / 100 : 0,
    });
  }

  rows.sort((a, b) => b.totalCitations - a.totalCitations);

  return NextResponse.json({ rankings: rows });
}
