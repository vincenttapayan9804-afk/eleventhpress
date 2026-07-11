/**
 * Reference validation against OpenAlex — a free, keyless, no-auth scholarly
 * metadata index (https://openalex.org). Given a raw citation string, tries
 * to resolve it to a real work: a DOI found in the text is looked up
 * directly, otherwise the text is matched by title search.
 *
 * NOTE: api.openalex.org is not reachable from this development sandbox
 * (network policy blocks scholarly-API hosts here — confirmed via direct
 * curl, a categorical block rather than a transient failure). This was
 * built against OpenAlex's documented, stable REST shape and defensively
 * parsed so a shape mismatch degrades to AMBIGUOUS rather than throwing,
 * but it has not been exercised against the live API from this
 * environment. Run one real validation after deploying (where outbound
 * internet access is unrestricted) before relying on it.
 */

const OPENALEX_BASE = "https://api.openalex.org";
// OpenAlex's "polite pool" gets faster, more reliable rate limits for
// requests that identify a contact — see https://docs.openalex.org/how-to-use-the-api/rate-limits-and-authentication
const USER_AGENT = "EPIP-Citation-Validator/1.0 (mailto:editorial@eleventhpress.org)";

export interface ReferenceValidation {
  status: "VALID" | "NOT_FOUND" | "AMBIGUOUS";
  doi?: string;
  resolvedTitle?: string;
  openAlexId?: string;
}

const DOI_PATTERN = /\b10\.\d{4,9}\/[^\s"<>]+/;

/**
 * Strips common trailing punctuation a DOI regex match picks up from
 * prose (closing parens, periods, commas) that aren't part of the DOI.
 */
function cleanDoi(raw: string): string {
  return raw.replace(/[).,;]+$/, "");
}

export async function validateReference(rawText: string): Promise<ReferenceValidation> {
  const doiMatch = rawText.match(DOI_PATTERN);
  if (doiMatch) {
    const doi = cleanDoi(doiMatch[0]);
    const byDoi = await lookupByDoi(doi);
    if (byDoi) return byDoi;
    // Fall through to title search — a malformed/typo'd DOI shouldn't
    // stop us from finding the work by its title.
  }

  const title = extractLikelyTitle(rawText);
  if (!title) return { status: "AMBIGUOUS" };
  return searchByTitle(title);
}

async function lookupByDoi(doi: string): Promise<ReferenceValidation | null> {
  try {
    const res = await fetch(`${OPENALEX_BASE}/works/doi:${encodeURIComponent(doi)}`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (res.status === 404) return { status: "NOT_FOUND" };
    if (!res.ok) return null;
    const work = await res.json();
    if (!work?.id) return null;
    return {
      status: "VALID",
      doi: (work.doi as string | undefined)?.replace(/^https?:\/\/doi\.org\//, ""),
      resolvedTitle: work.title,
      openAlexId: (work.id as string | undefined)?.replace(/^https?:\/\/openalex\.org\//, ""),
    };
  } catch (e) {
    console.error("[citations] OpenAlex DOI lookup failed:", e);
    return null;
  }
}

async function searchByTitle(title: string): Promise<ReferenceValidation> {
  try {
    const res = await fetch(
      `${OPENALEX_BASE}/works?search=${encodeURIComponent(title)}&per_page=1`,
      { headers: { "User-Agent": USER_AGENT } }
    );
    if (!res.ok) return { status: "AMBIGUOUS" };
    const data = await res.json();
    const work = data?.results?.[0];
    if (!work?.id) return { status: "NOT_FOUND" };

    // A search match isn't necessarily the right work — require the
    // returned title to substantially overlap with what we searched for
    // before calling it VALID, otherwise treat it as AMBIGUOUS so an
    // editor reviews it rather than trusting a loose match.
    const similarity = titleOverlap(title, work.title || "");
    if (similarity < 0.5) return { status: "AMBIGUOUS", resolvedTitle: work.title };

    return {
      status: "VALID",
      doi: (work.doi as string | undefined)?.replace(/^https?:\/\/doi\.org\//, ""),
      resolvedTitle: work.title,
      openAlexId: (work.id as string | undefined)?.replace(/^https?:\/\/openalex\.org\//, ""),
    };
  } catch (e) {
    console.error("[citations] OpenAlex title search failed:", e);
    return { status: "AMBIGUOUS" };
  }
}

/** Very rough citation-string title extraction: the longest quoted or
 * sentence-like span, since citation formats vary too much for a real
 * parser to be worth building here — OpenAlex's own fuzzy search absorbs
 * most of the slack. */
function extractLikelyTitle(rawText: string): string | null {
  const quoted = rawText.match(/[""]([^""]{10,})[""]/);
  if (quoted) return quoted[1];

  // Fall back to the whole string minus a leading "Author, A. (Year)."
  // prefix, capped to a reasonable search-query length.
  const withoutAuthorYear = rawText.replace(/^[^.]*\(\d{4}[a-z]?\)\.?\s*/, "");
  const candidate = (withoutAuthorYear || rawText).trim();
  return candidate.length >= 10 ? candidate.slice(0, 200) : null;
}

/** Word-overlap ratio (Jaccard-ish) between two titles, case/punct-insensitive. */
function titleOverlap(a: string, b: string): number {
  const words = (s: string) =>
    new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2));
  const setA = words(a);
  const setB = words(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let overlap = 0;
  for (const w of setA) if (setB.has(w)) overlap++;
  return overlap / Math.min(setA.size, setB.size);
}
