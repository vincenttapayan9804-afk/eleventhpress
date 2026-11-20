import { NextRequest, NextResponse } from "next/server";
import { discoverAcrossSources } from "@/lib/open-discovery";

/**
 * GET /api/discover?q=...
 * Public, keyless fan-out search across Crossref, OpenAlex, Semantic
 * Scholar, ERIC, PubMed Central, Zenodo, and (when CORE_API_KEY is
 * configured) CORE — backs the Resources → Discover tab. Results are
 * deduplicated by DOI where available (first source to surface a given
 * DOI wins), since the same work is often indexed by several sources.
 * Capped at 5 results per source so one search never sends more than a
 * handful of requests worth of load to any single upstream API.
 */
const RESULTS_PER_SOURCE = 5;

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 200);

  if (q.length < 2) {
    return NextResponse.json({ query: q, results: [], sources: {} });
  }

  const { results, sources } = await discoverAcrossSources(q, RESULTS_PER_SOURCE);

  return NextResponse.json(
    { query: q, results, sources },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } }
  );
}
