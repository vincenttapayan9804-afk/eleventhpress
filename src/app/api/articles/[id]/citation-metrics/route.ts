import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchWorkCitationMetrics } from "@/lib/citation-metrics";

/**
 * GET /api/articles/[id]/citation-metrics
 *
 * Real, live "Comparative Citation Analysis" for one article — the
 * article's own citation count plus, when OpenAlex has computed it, where
 * that count sits among works published the same year
 * (`cited_by_percentile_year`). Public and unauthenticated, matching this
 * article's other public sub-routes (/body, /data-tables).
 *
 * Fetched live per request rather than read from the DB-cached
 * Article.citations field (refreshed only on deploy by
 * scripts/refresh-citation-metrics.ts) — a single article detail view can
 * afford one live external call, unlike a listing of many articles. Edge-
 * cached for an hour since the underlying number doesn't meaningfully
 * change faster than that.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const article = await db.article.findUnique({
    where: { id },
    select: { status: true, doi: true },
  });

  if (!article || article.status !== "PUBLISHED" || !article.doi) {
    return NextResponse.json({ available: false, reason: "no_doi" });
  }

  const metrics = await fetchWorkCitationMetrics(article.doi);
  if (!metrics) {
    return NextResponse.json(
      { available: false, reason: "not_indexed" },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
    );
  }

  return NextResponse.json(
    {
      available: true,
      citedByCount: metrics.citedByCount,
      publicationYear: metrics.publicationYear,
      percentileYearMin: metrics.percentileYearMin,
      percentileYearMax: metrics.percentileYearMax,
      source: "openalex",
    },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
  );
}
