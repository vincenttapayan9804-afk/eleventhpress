import { NextResponse } from "next/server";
import { db } from "@/lib/db";

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
 */
export async function GET() {
  const [grouped, indexedRows] = await Promise.all([
    db.article.groupBy({
      by: ["discipline"],
      where: { status: "PUBLISHED" },
      _count: { _all: true },
      _sum: { citations: true, views: true },
    }),
    db.article.findMany({
      where: { status: "PUBLISHED", doiStatus: { in: ["REGISTERED", "PUBLISHED"] } },
      select: { discipline: true },
      distinct: ["discipline"],
    }),
  ]);

  const indexedSet = new Set(indexedRows.map((r) => r.discipline));

  const disciplines = grouped
    .map((g) => ({
      discipline: g.discipline,
      articles: g._count._all,
      citations: g._sum.citations ?? 0,
      views: g._sum.views ?? 0,
      indexed: indexedSet.has(g.discipline),
    }))
    .sort((a, b) => b.articles - a.articles);

  return NextResponse.json({ disciplines });
}
