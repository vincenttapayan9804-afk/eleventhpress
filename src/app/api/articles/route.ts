import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Sort columns supported by /api/articles, each paired with the field used
 * to break ties in keyset pagination (see decodeCursor/keysetWhere below).
 * All are indexed (see prisma/schema.prisma Article @@index block) so both
 * the ORDER BY and the cursor comparison stay index-backed regardless of
 * how deep a harvester or browsing session pages.
 */
const SORTS: Record<string, { field: "publishedAt" | "citations" | "views" | "title"; dir: "asc" | "desc" }> = {
  newest: { field: "publishedAt", dir: "desc" },
  cited: { field: "citations", dir: "desc" },
  viewed: { field: "views", dir: "desc" },
  title: { field: "title", dir: "asc" },
};

type Cursor = { v: string | number; id: string };

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}
function decodeCursor(s: string | null): Cursor | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(Buffer.from(s, "base64url").toString("utf-8"));
    if (parsed && typeof parsed.id === "string") return parsed;
  } catch {}
  return null;
}

/**
 * Builds a keyset (WHERE (sortField, id) < cursor) condition equivalent to
 * SQL row-value comparison — Prisma has no native tuple comparison, so it's
 * expanded into the standard `col < v OR (col = v AND id < cursorId)` OR
 * chain. `after` means "strictly past this cursor in the current sort
 * direction" (used for both Next and Prev, since Prev just re-runs the
 * query with the opposite sort direction and reverses the page afterward).
 */
function keysetWhere(field: string, dir: "asc" | "desc", cursor: Cursor, reverseDir: boolean) {
  const effectiveDir = reverseDir ? (dir === "asc" ? "desc" : "asc") : dir;
  const op = effectiveDir === "desc" ? "lt" : "gt";
  return {
    OR: [
      { [field]: { [op]: cursor.v } },
      { [field]: { equals: cursor.v }, id: { [op]: cursor.id } },
    ],
  };
}

/**
 * GET /api/articles
 * Public list/search of PUBLISHED articles.
 *
 * Two pagination modes:
 *  - Offset (`page`/`pageSize`, unchanged): fine for shallow pages (page 1
 *    especially — no OFFSET at all) and kept for backward compatibility
 *    with any existing caller. OFFSET cost grows with page depth on a large
 *    corpus.
 *  - Cursor (`cursor`/`dir`): constant-time regardless of depth. The
 *    browse UI (Previous/Next only, no arbitrary page-jump) uses this via
 *    the `nextCursor`/`prevCursor` returned in every response.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const discipline = searchParams.get("discipline") || "";
  const sortKey = searchParams.get("sort") || "newest";
  const sort = SORTS[sortKey] || SORTS.newest;
  const pageSize = Math.min(48, Math.max(1, parseInt(searchParams.get("pageSize") || "12", 10)));
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const cursorParam = decodeCursor(searchParams.get("cursor"));
  const dir = searchParams.get("dir") === "prev" ? "prev" : "next";

  const where: any = { status: "PUBLISHED" };
  if (discipline) where.discipline = discipline;
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { abstract: { contains: q } },
      { keywords: { contains: q } },
      { authors: { contains: q } },
    ];
  }

  const orderBy: any[] = [{ [sort.field]: sort.dir }, { id: sort.dir }];

  let queryWhere = where;
  let queryOrderBy = orderBy;
  if (cursorParam) {
    const keyset = keysetWhere(sort.field, sort.dir, cursorParam, dir === "prev");
    queryWhere = where.OR || where.AND ? { AND: [where, keyset] } : { ...where, ...keyset };
    if (dir === "prev") {
      // Walk backward in reverse-sorted order, then flip the page back to
      // display order below — this is what lets a single keyset mechanism
      // serve both Next and Prev with one cursor per page boundary.
      queryOrderBy = [{ [sort.field]: sort.dir === "asc" ? "desc" : "asc" }, { id: sort.dir === "asc" ? "desc" : "asc" }];
    }
  }

  const [rawItems, total] = await Promise.all([
    db.article.findMany({
      where: queryWhere,
      orderBy: queryOrderBy,
      // Only the offset path needs `skip`; the cursor path already scopes
      // rows via the keyset WHERE above, so skip stays 0 there regardless
      // of page depth.
      skip: cursorParam ? 0 : (page - 1) * pageSize,
      take: pageSize,
      include: { issue: true, journal: true },
    }),
    db.article.count({ where }),
  ]);
  const items = dir === "prev" && cursorParam ? rawItems.slice().reverse() : rawItems;

  const first = items[0];
  const last = items[items.length - 1];
  const prevCursor = first ? encodeCursor({ v: (first as any)[sort.field], id: first.id }) : null;
  const nextCursor = last ? encodeCursor({ v: (last as any)[sort.field], id: last.id }) : null;

  return NextResponse.json({
    items: items.map((a) => ({
      id: a.id,
      doi: a.doi,
      title: a.title,
      abstract: a.abstract,
      keywords: a.keywords,
      discipline: a.discipline,
      authors: a.authors,
      reviewModel: a.reviewModel,
      views: a.views,
      downloads: a.downloads,
      citations: a.citations,
      publishedAt: a.publishedAt,
      volume: a.issue?.volume ?? null,
      issueNumber: a.issue?.issueNumber ?? null,
      year: a.issue?.year ?? null,
      journalName: a.journal?.name,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    nextCursor: items.length === pageSize ? nextCursor : null,
    prevCursor,
  }, {
    // Fully public, unauthenticated, identical for every visitor per query
    // string (status is hardcoded to PUBLISHED above) — safe for Vercel's
    // CDN to cache at the edge. Short TTL keeps a newly published article
    // showing up within seconds rather than serving a genuinely stale list.
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300" },
  });
}
