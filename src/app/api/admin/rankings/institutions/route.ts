import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { withRlsContext } from "@/lib/db-rls";

/**
 * GET /api/admin/rankings/institutions
 * EP University OS Phase 5 — SUPER_ADMIN only, same platform-level-only
 * posture as GET /api/admin/tenants: a cross-tenant comparative view is
 * inherently a platform-operator capability, not something one
 * TENANT_ADMIN should see about another institution. There is no
 * TENANT_ADMIN variant of this route by design (see
 * docs/university-os-phase5.md).
 *
 * Computed live from each tenant's PUBLISHED Article rows (views,
 * downloads, shares, citations — all already-existing counters, no new
 * schema), grouped via Journal.tenantId — the same transitive-scoping
 * relationship Whitelabel Phase 5 established for Article isolation.
 * There is no snapshot/history table: like the COUNTER SUSHI reports in
 * src/lib/counter.ts, this is a live aggregation, not a stored ranking.
 */
export async function GET(req: NextRequest) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  const sortBy = req.nextUrl.searchParams.get("sortBy") || "citations";
  const sortKey = (["articles", "views", "downloads", "shares", "citations"] as const).includes(sortBy as any)
    ? (sortBy as "articles" | "views" | "downloads" | "shares" | "citations")
    : "citations";

  const { tenants, articles } = await withRlsContext(session, async (tx) => {
    const tenants = await tx.tenant.findMany({
      select: { id: true, name: true, slug: true, isPlatform: true },
      orderBy: { createdAt: "asc" },
    });
    const articles = await tx.article.findMany({
      where: { status: "PUBLISHED" },
      select: {
        views: true,
        downloads: true,
        shares: true,
        citations: true,
        journal: { select: { tenantId: true } },
      },
    });
    return { tenants, articles };
  });

  const totals = new Map<
    string,
    { articles: number; views: number; downloads: number; shares: number; citations: number }
  >();
  for (const a of articles) {
    const tenantId = a.journal?.tenantId;
    if (!tenantId) continue; // pre-Phase-5 Journal row with no tenant attribution
    const t = totals.get(tenantId) || { articles: 0, views: 0, downloads: 0, shares: 0, citations: 0 };
    t.articles += 1;
    t.views += a.views;
    t.downloads += a.downloads;
    t.shares += a.shares;
    t.citations += a.citations;
    totals.set(tenantId, t);
  }

  const rows = tenants.map((t) => {
    const stats = totals.get(t.id) || { articles: 0, views: 0, downloads: 0, shares: 0, citations: 0 };
    return {
      tenantId: t.id,
      name: t.name,
      slug: t.slug,
      isPlatform: t.isPlatform,
      articleCount: stats.articles,
      totalViews: stats.views,
      totalDownloads: stats.downloads,
      totalShares: stats.shares,
      totalCitations: stats.citations,
      avgCitationsPerArticle: stats.articles > 0 ? Math.round((stats.citations / stats.articles) * 100) / 100 : 0,
    };
  });

  const key = sortKey === "articles" ? "articleCount" : sortKey === "views" ? "totalViews" : sortKey === "downloads" ? "totalDownloads" : sortKey === "shares" ? "totalShares" : "totalCitations";
  rows.sort((a, b) => (b as any)[key] - (a as any)[key]);

  return NextResponse.json({ rankings: rows, sortBy: sortKey });
}
