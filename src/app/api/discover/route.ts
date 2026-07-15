import { NextRequest, NextResponse } from "next/server";
import {
  searchCrossref,
  searchOpenAlex,
  searchSemanticScholar,
  searchEric,
  searchPubMedCentral,
  searchZenodo,
  searchCore,
  type DiscoveryResult,
  type DiscoverySource,
} from "@/lib/open-discovery";

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

  const [crossref, openalex, semanticScholar, eric, pubmedCentral, zenodo, core] = await Promise.all([
    searchCrossref(q, RESULTS_PER_SOURCE),
    searchOpenAlex(q, RESULTS_PER_SOURCE),
    searchSemanticScholar(q, RESULTS_PER_SOURCE),
    searchEric(q, RESULTS_PER_SOURCE),
    searchPubMedCentral(q, RESULTS_PER_SOURCE),
    searchZenodo(q, RESULTS_PER_SOURCE),
    searchCore(q, RESULTS_PER_SOURCE),
  ]);

  const grouped: Record<DiscoverySource, DiscoveryResult[]> = {
    crossref,
    openalex,
    semantic_scholar: semanticScholar,
    eric,
    pubmed_central: pubmedCentral,
    zenodo,
    core,
  };

  const seen = new Set<string>();
  const results: DiscoveryResult[] = [];
  for (const list of Object.values(grouped)) {
    for (const r of list) {
      const key = r.doi ? `doi:${r.doi.toLowerCase()}` : `${r.source}:${r.title.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(r);
    }
  }

  const sources = Object.fromEntries(Object.entries(grouped).map(([source, list]) => [source, list.length])) as Record<
    DiscoverySource,
    number
  >;

  return NextResponse.json(
    { query: q, results, sources },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } }
  );
}
