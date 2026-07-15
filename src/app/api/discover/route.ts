import { NextRequest, NextResponse } from "next/server";
import { searchCrossref, searchOpenAlex, searchSemanticScholar, type DiscoveryResult } from "@/lib/open-discovery";

/**
 * GET /api/discover?q=...
 * Public, keyless fan-out search across Crossref, OpenAlex, and Semantic
 * Scholar — backs the Resources → Discover tab. Results are deduplicated
 * by DOI (first source to surface a given DOI wins) since the same work
 * is often indexed by all three. Capped at 5 results per source so one
 * search never sends more than 15 total requests worth of load upstream.
 */
const RESULTS_PER_SOURCE = 5;

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 200);

  if (q.length < 2) {
    return NextResponse.json({ query: q, results: [], sources: { crossref: 0, openalex: 0, semanticScholar: 0 } });
  }

  const [crossref, openalex, semanticScholar] = await Promise.all([
    searchCrossref(q, RESULTS_PER_SOURCE),
    searchOpenAlex(q, RESULTS_PER_SOURCE),
    searchSemanticScholar(q, RESULTS_PER_SOURCE),
  ]);

  const seen = new Set<string>();
  const results: DiscoveryResult[] = [];
  for (const r of [...crossref, ...openalex, ...semanticScholar]) {
    const key = r.doi ? `doi:${r.doi.toLowerCase()}` : `${r.source}:${r.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(r);
  }

  return NextResponse.json(
    {
      query: q,
      results,
      sources: { crossref: crossref.length, openalex: openalex.length, semanticScholar: semanticScholar.length },
    },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } }
  );
}
