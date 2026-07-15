/**
 * Live cross-database literature search against free, reputable open
 * scholarly data sources. Backs the Resources → Discover tab: a reader
 * searches once and sees real results from everywhere this module can
 * genuinely reach, so they can keep reading beyond this platform rather
 * than dead-ending here. This is a readership-expansion feature, not a
 * curated static link list.
 *
 * Every function here returns only what the source actually returned —
 * no fabricated authors, years, or links. A source that's down, rate-
 * limited, or returns an unexpected shape degrades to an empty array for
 * that source alone; the other sources still render.
 *
 * Live, keyless sources (always attempted): Crossref, OpenAlex, Semantic
 * Scholar, ERIC, PubMed Central, Zenodo.
 *
 * Opportunistic source: CORE's search API requires a free, self-service
 * API key (register at core.ac.uk) — searchCore() returns an empty array
 * immediately when CORE_API_KEY isn't set in the environment, rather than
 * fabricating results or guessing at auth. Set the env var on a deployment
 * to light it up; no code change needed.
 *
 * Deliberately NOT integrated here: BASE (its search API requires signing
 * a registered access agreement, not a self-service key — the same class
 * of dependency as this codebase's SAML/LTI integrations, which show
 * "not yet configured" rather than a fake success) and OER Commons (no
 * public search API to build against at all). Both are presented in the
 * Discover tab as direct external search links instead of guessed, likely-
 * wrong integration code.
 *
 * NOTE: none of these hosts are reachable from this development sandbox
 * (same network restriction documented in citations.ts and
 * citation-metrics.ts). Built against each API's documented, stable REST
 * shape and defensively parsed; not yet exercised against the live APIs
 * from this environment.
 */

const FETCH_TIMEOUT_MS = 6000;
// Crossref and OpenAlex both offer a faster, more reliable "polite pool"
// for requests that identify a contact — see
// https://api.crossref.org/swagger-ui/index.html and
// https://docs.openalex.org/how-to-use-the-api/rate-limits-and-authentication
const USER_AGENT = "EPIP-Open-Discovery/1.0 (mailto:editorial@eleventhpress.org)";

export type DiscoverySource =
  | "crossref"
  | "openalex"
  | "semantic_scholar"
  | "eric"
  | "pubmed_central"
  | "zenodo"
  | "core";

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

/** ERIC (api.ies.ed.gov) — the U.S. Dept. of Education's free, keyless
 *  index of education research. "ED"-prefixed records are ERIC-hosted
 *  full-text documents; "EJ"-prefixed records are journal articles ERIC
 *  only indexes (no ERIC-hosted full text), so only ED records get an
 *  openAccessUrl here. */
export async function searchEric(query: string, limit = 5): Promise<DiscoveryResult[]> {
  const data = await fetchJson(`https://api.ies.ed.gov/eric/?search=${encodeURIComponent(query)}&format=json&rows=${limit}`);
  const docs = data?.response?.docs;
  if (!Array.isArray(docs)) return [];
  return docs
    .map((doc: any): DiscoveryResult | null => {
      const title = typeof doc.title === "string" ? doc.title : null;
      const id = typeof doc.id === "string" ? doc.id : null;
      if (!title || !id) return null;
      const authors = Array.isArray(doc.author) ? doc.author.filter((a: unknown) => typeof a === "string").join(", ") : "";
      const yearRaw = Array.isArray(doc.publicationdateyear) ? doc.publicationdateyear[0] : doc.publicationdateyear;
      const year =
        typeof yearRaw === "number" ? yearRaw : typeof yearRaw === "string" && /^\d{4}$/.test(yearRaw) ? parseInt(yearRaw, 10) : null;
      const venue = Array.isArray(doc.source) ? doc.source[0] || null : typeof doc.source === "string" ? doc.source : null;
      return {
        source: "eric",
        title,
        authors,
        year,
        venue,
        doi: null,
        url: `https://eric.ed.gov/?id=${id}`,
        openAccessUrl: id.startsWith("ED") ? `https://files.eric.ed.gov/fulltext/${id}.pdf` : null,
      };
    })
    .filter((r): r is DiscoveryResult => r !== null);
}

// NCBI E-utilities asks unauthenticated callers to identify themselves via
// tool/email params for their politeness/rate-limit policy, same spirit as
// the "polite pool" headers used for Crossref/OpenAlex above.
const NCBI_TOOL = "EPIP-Open-Discovery";
const NCBI_EMAIL = "editorial@eleventhpress.org";

/** PubMed Central (NCBI E-utilities) — NIH/NLM's free, keyless full-text
 *  biomedical/life-sciences archive. Every PMC record is itself an
 *  open-access full-text page, so the article URL doubles as the
 *  open-access link. */
export async function searchPubMedCentral(query: string, limit = 5): Promise<DiscoveryResult[]> {
  const searchData = await fetchJson(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pmc&term=${encodeURIComponent(query)}&retmode=json&retmax=${limit}&tool=${NCBI_TOOL}&email=${NCBI_EMAIL}`
  );
  const ids: string[] = Array.isArray(searchData?.esearchresult?.idlist) ? searchData.esearchresult.idlist : [];
  if (ids.length === 0) return [];

  const summaryData = await fetchJson(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pmc&id=${ids.join(",")}&retmode=json&tool=${NCBI_TOOL}&email=${NCBI_EMAIL}`
  );
  const result = summaryData?.result;
  if (!result) return [];

  return ids
    .map((id): DiscoveryResult | null => {
      const doc = result[id];
      const title = typeof doc?.title === "string" ? doc.title.replace(/<[^>]+>/g, "") : null;
      if (!title) return null;
      const authors = Array.isArray(doc.authors) ? doc.authors.map((a: any) => a?.name).filter(Boolean).join(", ") : "";
      const yearMatch = typeof doc.pubdate === "string" ? doc.pubdate.match(/\d{4}/) : null;
      const url = `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${id}/`;
      return {
        source: "pubmed_central",
        title,
        authors,
        year: yearMatch ? parseInt(yearMatch[0], 10) : null,
        venue: typeof doc.fulljournalname === "string" ? doc.fulljournalname : typeof doc.source === "string" ? doc.source : null,
        doi: null,
        url,
        openAccessUrl: url,
      };
    })
    .filter((r): r is DiscoveryResult => r !== null);
}

/** Zenodo — CERN's free, keyless open-access repository for datasets,
 *  software, and preprints (also where this platform's own linked
 *  datasets live, src/lib/zenodo.ts). A record with attached files gets
 *  an openAccessUrl; a metadata-only record doesn't. */
export async function searchZenodo(query: string, limit = 5): Promise<DiscoveryResult[]> {
  const data = await fetchJson(`https://zenodo.org/api/records/?q=${encodeURIComponent(query)}&size=${limit}&sort=mostrecent`);
  const hits = data?.hits?.hits;
  if (!Array.isArray(hits)) return [];
  return hits
    .map((rec: any): DiscoveryResult | null => {
      const title = typeof rec?.metadata?.title === "string" ? rec.metadata.title : null;
      if (!title) return null;
      const authors = Array.isArray(rec.metadata?.creators)
        ? rec.metadata.creators.map((c: any) => c?.name).filter(Boolean).join(", ")
        : "";
      const yearMatch = typeof rec.metadata?.publication_date === "string" ? rec.metadata.publication_date.match(/^\d{4}/) : null;
      const doi = cleanDoi(rec.doi || rec.metadata?.doi);
      const html = typeof rec.links?.self_html === "string" ? rec.links.self_html : typeof rec.links?.html === "string" ? rec.links.html : null;
      const hasFiles = Array.isArray(rec.files) && rec.files.length > 0;
      return {
        source: "zenodo",
        title,
        authors,
        year: yearMatch ? parseInt(yearMatch[0], 10) : null,
        venue: "Zenodo",
        doi,
        url: doi ? `https://doi.org/${doi}` : html || "https://zenodo.org",
        openAccessUrl: hasFiles ? html : null,
      };
    })
    .filter((r): r is DiscoveryResult => r !== null);
}

/** CORE (api.core.ac.uk v3) — the world's largest aggregator of
 *  open-access research. Its search API requires a free, self-service
 *  API key (register at core.ac.uk); returns an empty array immediately
 *  when CORE_API_KEY isn't configured rather than guessing at auth or
 *  fabricating results. Set the env var on a deployment to enable it —
 *  no code change needed. */
export async function searchCore(query: string, limit = 5): Promise<DiscoveryResult[]> {
  const apiKey = process.env.CORE_API_KEY;
  if (!apiKey) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(query)}&limit=${limit}`, {
      headers: { Authorization: `Bearer ${apiKey}`, "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const results = data?.results;
    if (!Array.isArray(results)) return [];
    return results
      .map((work: any): DiscoveryResult | null => {
        const title = typeof work.title === "string" ? work.title : null;
        if (!title) return null;
        const authors = Array.isArray(work.authors) ? work.authors.map((a: any) => a?.name).filter(Boolean).join(", ") : "";
        const doi = cleanDoi(work.doi);
        const openAccessUrl =
          typeof work.downloadUrl === "string" ? work.downloadUrl : Array.isArray(work.sourceFulltextUrls) ? work.sourceFulltextUrls[0] || null : null;
        return {
          source: "core",
          title,
          authors,
          year: typeof work.yearPublished === "number" ? work.yearPublished : null,
          venue: typeof work.publisher === "string" ? work.publisher : null,
          doi,
          url: doi ? `https://doi.org/${doi}` : openAccessUrl || "https://core.ac.uk",
          openAccessUrl,
        };
      })
      .filter((r): r is DiscoveryResult => r !== null);
  } catch (e) {
    console.error("[open-discovery] CORE search failed:", e);
    return [];
  } finally {
    clearTimeout(timer);
  }
}
