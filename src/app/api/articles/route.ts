import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { withTenantRlsContext } from "@/lib/db-rls";

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
function parseIntParam(v: string | null): number | null {
  if (!v || !/^\d{1,4}$/.test(v)) return null;
  return parseInt(v, 10);
}

/** Earliest and latest publication year in this tenant's published corpus. */
async function publishedYearBounds(tenantId: string | null): Promise<{ min: number; max: number } | null> {
  const agg = await withTenantRlsContext(tenantId, (tx) =>
    tx.article.aggregate({
      where: { status: "PUBLISHED", journal: { tenantId }, publishedAt: { not: null } },
      _min: { publishedAt: true },
      _max: { publishedAt: true },
    })
  );
  if (!agg._min.publishedAt || !agg._max.publishedAt) return null;
  return { min: agg._min.publishedAt.getUTCFullYear(), max: agg._max.publishedAt.getUTCFullYear() };
}

/**
 * Turns the `year` / `month` (1-12) query params into half-open UTC date
 * ranges on publishedAt. Returns `ranges: null` when no date filter applies.
 */
async function publicationDateRanges(
  year: number | null,
  month: number | null,
  tenantId: string | null
): Promise<{ years: { min: number; max: number } | null; ranges: [Date, Date][] | null }> {
  const validYear = year !== null && year >= 1900 && year <= 2999 ? year : null;
  const validMonth = month !== null && month >= 1 && month <= 12 ? month : null;
  if (validYear !== null) {
    return {
      years: null,
      ranges: [
        validMonth !== null
          ? [new Date(Date.UTC(validYear, validMonth - 1, 1)), new Date(Date.UTC(validYear, validMonth, 1))]
          : [new Date(Date.UTC(validYear, 0, 1)), new Date(Date.UTC(validYear + 1, 0, 1))],
      ],
    };
  }
  if (validMonth === null) return { years: null, ranges: null };
  const bounds = await publishedYearBounds(tenantId);
  if (!bounds) return { years: null, ranges: [] };
  const ranges: [Date, Date][] = [];
  for (let y = bounds.min; y <= bounds.max; y++) {
    ranges.push([new Date(Date.UTC(y, validMonth - 1, 1)), new Date(Date.UTC(y, validMonth, 1))]);
  }
  return { years: bounds, ranges };
}

function yearList(bounds: { min: number; max: number } | null): number[] {
  if (!bounds) return [];
  const out: number[] = [];
  for (let y = bounds.max; y >= bounds.min; y--) out.push(y);
  return out;
}

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

  // Whitelabel Phase 7 — this endpoint had never been scoped by tenant
  // (Phase 5 only wired Article isolation into the submission path, not
  // this public browse/search one), so a visitor on any tenant's site
  // could search and see every other tenant's published articles too.
  // Article has no tenantId column of its own (see Journal.tenantId's doc
  // comment), so the filter goes through the journal relation.
  const tenant = await resolveTenantFromHeaders(req.headers);
  const tenantId = tenant?.id ?? null;

  const where: any = { status: "PUBLISHED", journal: { tenantId } };
  if (discipline) where.discipline = discipline;

  // Publication year/month filters. A month without a year means "that month
  // in any year" (e.g. every March issue), expanded to one UTC date range
  // per year in the corpus since Prisma can't filter on a date part directly.
  const { years: yearBounds, ranges: dateRanges } = await publicationDateRanges(
    parseIntParam(searchParams.get("year")),
    parseIntParam(searchParams.get("month")),
    tenantId
  );
  if (dateRanges) {
    where.AND = [{ OR: dateRanges.map(([gte, lt]) => ({ publishedAt: { gte, lt } })) }];
  }
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

  const [rawItems, total] = await withTenantRlsContext(tenantId, (tx) =>
    Promise.all([
      tx.article.findMany({
        where: queryWhere,
        orderBy: queryOrderBy,
        // Only the offset path needs `skip`; the cursor path already scopes
        // rows via the keyset WHERE above, so skip stays 0 there regardless
        // of page depth.
        skip: cursorParam ? 0 : (page - 1) * pageSize,
        take: pageSize,
        include: { issue: true, journal: true },
      }),
      tx.article.count({ where }),
    ])
  );
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
    // `facets=1`: the publication years the Year filter can offer.
    ...(searchParams.get("facets") === "1"
      ? { publicationYears: yearList(yearBounds ?? (await publishedYearBounds(tenantId))) }
      : {}),
  }, {
    // Fully public, unauthenticated, identical for every visitor per query
    // string (status is hardcoded to PUBLISHED above) — safe for Vercel's
    // CDN to cache at the edge. Short TTL keeps a newly published article
    // showing up within seconds rather than serving a genuinely stale list.
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300" },
  });
}
