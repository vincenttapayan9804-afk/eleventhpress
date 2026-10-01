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
      select: { id: true, name: true, slug: true, tenantId: true, parentDepartmentId: true },
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

  const EMPTY = { articles: 0, views: 0, downloads: 0, shares: 0, citations: 0 };

  // Department-hierarchy rollup — Department.parentDepartmentId has existed
  // since Phase 1 but, until now, was never read by any live code path
  // (see its schema comment). A parent department's rollup totals are its
  // own stats plus every descendant's, recursively, computed here rather
  // than persisted — same "derived live, no cache to go stale" posture as
  // the own-department totals above.
  const childrenOf = new Map<string, string[]>();
  for (const d of departments) {
    if (d.parentDepartmentId) {
      childrenOf.set(d.parentDepartmentId, [...(childrenOf.get(d.parentDepartmentId) || []), d.id]);
    }
  }
  const rollupCache = new Map<string, { articles: number; views: number; downloads: number; shares: number; citations: number }>();
  function rollupFor(deptId: string, seen: Set<string> = new Set()): typeof EMPTY {
    if (rollupCache.has(deptId)) return rollupCache.get(deptId)!;
    // Guards against a cyclic parent chain (data corruption, not a valid
    // hierarchy) infinite-looping this computation.
    if (seen.has(deptId)) return EMPTY;
    seen.add(deptId);
    const own = totals.get(deptId) || EMPTY;
    const acc = { ...own };
    for (const childId of childrenOf.get(deptId) || []) {
      const childRollup = rollupFor(childId, seen);
      acc.articles += childRollup.articles;
      acc.views += childRollup.views;
      acc.downloads += childRollup.downloads;
      acc.shares += childRollup.shares;
      acc.citations += childRollup.citations;
    }
    rollupCache.set(deptId, acc);
    return acc;
  }

  const rows = departments.map((d) => {
    const stats = totals.get(d.id) || EMPTY;
    const rollup = rollupFor(d.id);
    const hasChildren = (childrenOf.get(d.id) || []).length > 0;
    return {
      departmentId: d.id,
      name: d.name,
      slug: d.slug,
      tenantId: d.tenantId,
      parentDepartmentId: d.parentDepartmentId,
      articleCount: stats.articles,
      totalViews: stats.views,
      totalDownloads: stats.downloads,
      totalShares: stats.shares,
      totalCitations: stats.citations,
      avgCitationsPerArticle: stats.articles > 0 ? Math.round((stats.citations / stats.articles) * 100) / 100 : 0,
      // Rollup fields equal the own-department ones for a childless leaf;
      // only meaningfully different once a department actually has children.
      hasChildren,
      rollupArticleCount: rollup.articles,
      rollupTotalViews: rollup.views,
      rollupTotalDownloads: rollup.downloads,
      rollupTotalShares: rollup.shares,
      rollupTotalCitations: rollup.citations,
    };
  });

  const unassigned = totals.get(null);
  if (unassigned) {
    rows.push({
      departmentId: null as any,
      name: "Unassigned",
      slug: "",
      tenantId: (tenantId ?? null) as any,
      parentDepartmentId: null,
      articleCount: unassigned.articles,
      totalViews: unassigned.views,
      totalDownloads: unassigned.downloads,
      totalShares: unassigned.shares,
      totalCitations: unassigned.citations,
      avgCitationsPerArticle: unassigned.articles > 0 ? Math.round((unassigned.citations / unassigned.articles) * 100) / 100 : 0,
      hasChildren: false,
      rollupArticleCount: unassigned.articles,
      rollupTotalViews: unassigned.views,
      rollupTotalDownloads: unassigned.downloads,
      rollupTotalShares: unassigned.shares,
      rollupTotalCitations: unassigned.citations,
    });
  }

  rows.sort((a, b) => b.totalCitations - a.totalCitations);

  return NextResponse.json({ rankings: rows });
}
