import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { withTenantRlsContext } from "@/lib/db-rls";
import { DISCIPLINES } from "@/lib/article";

/**
 * GET /api/articles/discipline-stats
 * Public, unauthenticated — powers the browse page's 3D discipline
 * analytics panel. Aggregates only PUBLISHED articles, sorted by article
 * count so the largest disciplines render first (and get truncated first
 * when a caller caps the list, e.g. for a bounded 3D scene).
 *
 * "Indexed" here means at least one article in the discipline has a real,
 * registered Crossref DOI (doiStatus REGISTERED or PUBLISHED) — the one
 * per-article signal this codebase already tracks honestly. There's no
 * per-discipline indexing directory status (DOAJ/ROAD/etc. — see
 * src/lib/directory-listings.ts — apply to the journal as a whole), so this
 * doesn't fabricate one.
 *
 * Every discipline the journal covers (DISCIPLINES, the same twelve the home
 * page lists) is always returned, with zeros where nothing is published yet,
 * so the chart shows the journal's full scope rather than only the
 * disciplines that happen to have articles.
 */
export async function GET(req: NextRequest) {
  const tenant = await resolveTenantFromHeaders(req.headers);
  const [grouped, indexedRows] = await withTenantRlsContext(tenant?.id ?? null, (tx) =>
    Promise.all([
      tx.article.groupBy({
        by: ["discipline"],
        where: { status: "PUBLISHED" },
        _count: { _all: true },
        _sum: { citations: true, views: true },
      }),
      tx.article.findMany({
        where: { status: "PUBLISHED", doiStatus: { in: ["REGISTERED", "PUBLISHED"] } },
        select: { discipline: true },
        distinct: ["discipline"],
      }),
    ])
  );

  const indexedSet = new Set(indexedRows.map((r) => r.discipline));

  const byName = new Map(
    grouped.map((g) => [
      g.discipline,
      {
        discipline: g.discipline,
        articles: g._count._all,
        citations: g._sum.citations ?? 0,
        views: g._sum.views ?? 0,
        indexed: indexedSet.has(g.discipline),
      },
    ])
  );
  for (const d of DISCIPLINES) {
    if (!byName.has(d)) byName.set(d, { discipline: d, articles: 0, citations: 0, views: 0, indexed: false });
  }
  const disciplines = [...byName.values()].sort(
    (a, b) => b.articles - a.articles || a.discipline.localeCompare(b.discipline)
  );

  return NextResponse.json({ disciplines });
}
