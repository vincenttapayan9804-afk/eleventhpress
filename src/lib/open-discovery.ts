/**
 * Live cross-database literature search against three free, reputable,
 * keyless open scholarly data sources — Crossref REST, OpenAlex, and
 * Semantic Scholar's Graph API. Backs the Resources → Discover tab: a
 * reader searches once and sees real results from all three, so they can
 * keep reading beyond this platform rather than dead-ending here. This is
 * a genuine readership-expansion feature, not a curated static link list.
 *
 * Every function here returns only what the source actually returned —
 * no fabricated authors, years, or links. A source that's down, rate-
 * limited, or returns an unexpected shape degrades to an empty array for
 * that source alone; the other sources still render.
 *
 * NOTE: none of api.crossref.org / api.openalex.org / api.semanticscholar.org
 * are reachable from this development sandbox (same network restriction
 * documented in citations.ts and citation-metrics.ts). Built against each
 * API's documented, stable REST shape and defensively parsed; not yet
 * exercised against the live APIs from this environment.
 */

const FETCH_TIMEOUT_MS = 6000;
// Crossref and OpenAlex both offer a faster, more reliable "polite pool"
// for requests that identify a contact — see
// https://api.crossref.org/swagger-ui/index.html and
// https://docs.openalex.org/how-to-use-the-api/rate-limits-and-authentication
const USER_AGENT = "EPIP-Open-Discovery/1.0 (mailto:editorial@eleventhpress.org)";

export type DiscoverySource = "crossref" | "openalex" | "semantic_scholar";

export interface DiscoveryResult {
  source: DiscoverySource;
  title: string;
  authors: string;
  year: number | null;
  venue: string | null;
  doi: string | null;
  url: string;
  openAccessUrl: string | null;
}

async function fetchJson(url: string): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error(`[open-discovery] fetch failed for ${url}:`, e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function cleanDoi(doi: unknown): string | null {
  return typeof doi === "string" && doi.trim() ? doi.replace(/^https?:\/\/doi\.org\//i, "").trim() : null;
}

export async function searchCrossref(query: string, limit = 5): Promise<DiscoveryResult[]> {
  const data = await fetchJson(`https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${limit}`);
  const items = data?.message?.items;
  if (!Array.isArray(items)) return [];
  return items
    .map((item): DiscoveryResult | null => {
      const title = Array.isArray(item.title) ? item.title[0] : null;
      if (!title) return null;
      const authors = Array.isArray(item.author)
        ? item.author.map((a: any) => [a.given, a.family].filter(Boolean).join(" ")).filter(Boolean).join(", ")
        : "";
      const dateParts = item.issued?.["date-parts"]?.[0] || item["published-print"]?.["date-parts"]?.[0];
      const year = Array.isArray(dateParts) && typeof dateParts[0] === "number" ? dateParts[0] : null;
      const venue = Array.isArray(item["container-title"]) ? item["container-title"][0] || null : null;
      const doi = cleanDoi(item.DOI);
      return {
        source: "crossref",
        title,
        authors,
        year,
        venue,
        doi,
        url: doi ? `https://doi.org/${doi}` : typeof item.URL === "string" ? item.URL : "https://search.crossref.org",
        openAccessUrl: null,
      };
    })
    .filter((r): r is DiscoveryResult => r !== null);
}

export async function searchOpenAlex(query: string, limit = 5): Promise<DiscoveryResult[]> {
  const data = await fetchJson(`https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${limit}`);
  const results = data?.results;
  if (!Array.isArray(results)) return [];
  return results
    .map((work): DiscoveryResult | null => {
      const title = typeof work.title === "string" ? work.title : typeof work.display_name === "string" ? work.display_name : null;
      if (!title) return null;
      const authors = Array.isArray(work.authorships)
        ? work.authorships.map((a: any) => a?.author?.display_name).filter(Boolean).join(", ")
        : "";
      const doi = cleanDoi(work.doi);
      const openAccessUrl = typeof work.open_access?.oa_url === "string" ? work.open_access.oa_url : null;
      return {
        source: "openalex",
        title,
        authors,
        year: typeof work.publication_year === "number" ? work.publication_year : null,
        venue: typeof work.primary_location?.source?.display_name === "string" ? work.primary_location.source.display_name : null,
        doi,
        url: doi ? `https://doi.org/${doi}` : typeof work.id === "string" ? work.id : "https://openalex.org",
        openAccessUrl,
      };
    })
    .filter((r): r is DiscoveryResult => r !== null);
}

export async function searchSemanticScholar(query: string, limit = 5): Promise<DiscoveryResult[]> {
  const data = await fetchJson(
    `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=title,authors,year,venue,externalIds,openAccessPdf,url`
  );
  const items = data?.data;
  if (!Array.isArray(items)) return [];
  return items
    .map((paper): DiscoveryResult | null => {
      const title = typeof paper.title === "string" ? paper.title : null;
      if (!title) return null;
      const authors = Array.isArray(paper.authors) ? paper.authors.map((a: any) => a?.name).filter(Boolean).join(", ") : "";
      const doi = cleanDoi(paper.externalIds?.DOI);
      const openAccessUrl = typeof paper.openAccessPdf?.url === "string" ? paper.openAccessPdf.url : null;
      return {
        source: "semantic_scholar",
        title,
        authors,
        year: typeof paper.year === "number" ? paper.year : null,
        venue: typeof paper.venue === "string" && paper.venue ? paper.venue : null,
        doi,
        url: doi ? `https://doi.org/${doi}` : typeof paper.url === "string" ? paper.url : "https://www.semanticscholar.org",
        openAccessUrl,
      };
    })
    .filter((r): r is DiscoveryResult => r !== null);
}
