/**
 * Real citation metrics from OpenAlex (https://openalex.org) — the same
 * free, keyless, no-auth scholarly index already used for reference
 * validation (src/lib/citations.ts). This module is the honest replacement
 * for `Article.citations`, which the schema explicitly documents as "mock
 * analytics": every function here either returns a real, currently-true
 * number pulled live from OpenAlex, or `null` when OpenAlex has nothing —
 * never a fabricated or estimated count. A `null` (rendered as "not yet
 * indexed" by callers) is the correct, honest state for a just-published
 * article that citing works haven't reached yet, not a bug to paper over.
 *
 * NOTE: api.openalex.org is not reachable from this development sandbox
 * (same network restriction documented in citations.ts) — this has not
 * been exercised against the live API from this environment. Built against
 * OpenAlex's documented, stable REST shape and defensively parsed so a
 * shape mismatch degrades to `null` rather than throwing.
 */

const OPENALEX_BASE = "https://api.openalex.org";
const USER_AGENT = "EPIP-Citation-Metrics/1.0 (mailto:editorial@eleventhpress.org)";
const FETCH_TIMEOUT_MS = 5000;

async function fetchJson(url: string): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error(`[citation-metrics] fetch failed for ${url}:`, e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface WorkCitationMetrics {
  citedByCount: number;
  publicationYear: number | null;
  /** Percentile among works published the same year — only present when
   *  OpenAlex has computed it for this specific work; many works (especially
   *  very recently indexed ones) don't have this yet. */
  percentileYearMin: number | null;
  percentileYearMax: number | null;
  fetchedAt: string;
}

/** Real, live citation count + year-percentile for one article's DOI. */
export async function fetchWorkCitationMetrics(doi: string): Promise<WorkCitationMetrics | null> {
  const work = await fetchJson(`${OPENALEX_BASE}/works/doi:${encodeURIComponent(doi)}`);
  if (!work || typeof work.cited_by_count !== "number") return null;
  const pct = work.cited_by_percentile_year;
  return {
    citedByCount: work.cited_by_count,
    publicationYear: typeof work.publication_year === "number" ? work.publication_year : null,
    percentileYearMin: pct && typeof pct.min === "number" ? pct.min : null,
    percentileYearMax: pct && typeof pct.max === "number" ? pct.max : null,
    fetchedAt: new Date().toISOString(),
  };
}

export interface AuthorCitationMetrics {
  worksCount: number;
  citedByCount: number;
  hIndex: number | null;
  i10Index: number | null;
  fetchedAt: string;
}

/** Real, live scholarly output metrics for a person by ORCID — their whole
 *  body of work, not just what's published on this platform. */
export async function fetchAuthorCitationMetrics(orcid: string): Promise<AuthorCitationMetrics | null> {
  const cleaned = orcid.replace(/^https?:\/\/orcid\.org\//, "").trim();
  if (!cleaned) return null;
  const author = await fetchJson(`${OPENALEX_BASE}/authors/orcid:${encodeURIComponent(cleaned)}`);
  if (!author || typeof author.works_count !== "number") return null;
  const stats = author.summary_stats || {};
  return {
    worksCount: author.works_count,
    citedByCount: typeof author.cited_by_count === "number" ? author.cited_by_count : 0,
    hIndex: typeof stats.h_index === "number" ? stats.h_index : null,
    i10Index: typeof stats.i10_index === "number" ? stats.i10_index : null,
    fetchedAt: new Date().toISOString(),
  };
}

/** h-index computed from a plain list of citation counts — used as the
 *  platform-only fallback for authors without an ORCID to look up on
 *  OpenAlex (h-index across just what's published here, honestly labeled
 *  as such by callers rather than presented as a full scholarly h-index). */
export function computeHIndex(citationCounts: number[]): number {
  const sorted = [...citationCounts].sort((a, b) => b - a);
  let h = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] >= i + 1) h = i + 1;
    else break;
  }
  return h;
}
