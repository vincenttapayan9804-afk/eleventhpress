/**
 * Research Gap Finder (Eleventh Research Lab) — given a mix of this
 * platform's own published articles and researcher-pasted/searched
 * external URLs, asks the LLM to identify genuine gaps: questions or
 * angles none of the sources address, or where their findings conflict.
 *
 * Real-or-nothing contract, same family as glossary.ts/
 * related-explanation.ts: a wrong-but-plausible "gap" would actively
 * mislead a researcher's actual work, so there is no heuristic fallback —
 * mode is "llm" or "unavailable", never fabricated. Cost-first: tries the
 * free OpenRouter tier before any billed Anthropic call, same as the
 * platform's other free-LLM-first features, falling back to Anthropic
 * only if the free tier itself fails. A single retry on a transient LLM
 * failure (rate limit, momentary network error) before giving up —
 * research tools like this one saw "unavailable" more often than the
 * underlying LLM was actually unreachable.
 */
import dns from "dns/promises";
import { db } from "@/lib/db";
import { chatJSON, anyLLMAvailable } from "@/lib/llm";
import { htmlToPlainText } from "@/lib/chunk-embeddings";
import { formatCitation } from "@/lib/article";

const EXTERNAL_FETCH_TIMEOUT_MS = 10_000;
const EXTERNAL_FETCH_USER_AGENT = "EleventhPressResearchLab/1.0 (+https://eleventhpress.org)";
const MAX_EXCERPT_CHARS = 3000;

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function inCidr(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

/** Private/loopback/link-local/CGNAT IPv4 ranges — a URL resolving here
 * would let a pasted link reach this deployment's internal network. */
function isPrivateIPv4(ip: string): boolean {
  return (
    inCidr(ip, "10.0.0.0", 8) ||
    inCidr(ip, "172.16.0.0", 12) ||
    inCidr(ip, "192.168.0.0", 16) ||
    inCidr(ip, "127.0.0.0", 8) ||
    inCidr(ip, "169.254.0.0", 16) ||
    inCidr(ip, "0.0.0.0", 8) ||
    inCidr(ip, "100.64.0.0", 10)
  );
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return (
    lower === "::1" ||
    lower.startsWith("::ffff:127.") ||
    /^f[cd]/.test(lower) || // fc00::/7 (unique local)
    /^fe[89ab]/.test(lower) // fe80::/10 (link-local)
  );
}

/**
 * Validates that a researcher-pasted URL is http(s) and resolves to a
 * public address before we ever fetch it — blocks the obvious SSRF path
 * of pasting a link to this deployment's own internal network. Doesn't
 * defend against DNS-rebinding (a TOCTOU attack re-pointing the same
 * hostname between this check and the fetch below) — a real hardening
 * gap worth closing with an egress proxy if this ever needs to withstand
 * adversarial input; acceptable for now since this endpoint is only
 * reachable by authenticated AUTHOR/EXPERT/REVIEWER/EDITOR/ADMIN accounts.
 */
async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed");
  }
  const addresses = await dns.lookup(url.hostname, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new Error("Could not resolve host");
  for (const { address, family } of addresses) {
    if (family === 4 && isPrivateIPv4(address)) throw new Error("URL resolves to a private/internal address");
    if (family === 6 && isPrivateIPv6(address)) throw new Error("URL resolves to a private/internal address");
  }
  return url;
}

export interface FetchedSource {
  url: string;
  title: string;
  text: string;
}

/** Best-effort <title> extraction — falls back to the hostname so a
 * source always has a human-readable label even without one. */
function extractTitle(html: string, fallback: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = match?.[1]?.replace(/\s+/g, " ").trim();
  return title || fallback;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * Most scholarly landing pages (DOI resolvers, publisher sites, Crossref/
 * OpenAlex-indexed pages) embed the real abstract in a <meta> tag rather
 * than plain body text — the body is often mostly nav/cookie-banner/
 * related-articles boilerplate that drowns out the actual content once
 * stripped of tags. Trying citation_abstract (the scholarly-metadata
 * convention most publishers emit) then a plain description meta tag
 * gets a much higher-signal excerpt than scraping the full body when
 * either is present and substantial.
 */
function extractMetaExcerpt(html: string): string | null {
  const metaPatterns = [
    /<meta[^>]+name=["']citation_abstract["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i,
  ];
  for (const pattern of metaPatterns) {
    const match = html.match(pattern);
    const content = match?.[1] ? decodeHtmlEntities(match[1]).replace(/\s+/g, " ").trim() : "";
    // Below ~80 chars a "description" meta tag is almost always a generic
    // site tagline, not real abstract content — not worth preferring over
    // the full-body fallback.
    if (content.length >= 80) return content;
  }
  return null;
}

/**
 * Fetches and extracts readable text from a researcher-supplied URL —
 * either hand-pasted or picked from the open-data source search (see
 * src/app/api/discover/route.ts). Prefers a real abstract meta tag over
 * scraped body text when the page has one (see extractMetaExcerpt).
 * Exported so prisma-draft.ts can reuse the exact same SSRF-safe fetch
 * instead of duplicating it.
 */
export async function fetchExternalSource(rawUrl: string): Promise<FetchedSource | null> {
  try {
    const url = await assertPublicUrl(rawUrl);
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": EXTERNAL_FETCH_USER_AGENT, Accept: "text/html,text/plain" },
      redirect: "follow",
      signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) return null;
    const body = await res.text();
    const isHtml = contentType.includes("text/html");
    const text = isHtml ? extractMetaExcerpt(body) || htmlToPlainText(body) : body.replace(/\s+/g, " ").trim();
    if (!text) return null;
    return {
      url: url.toString(),
      title: isHtml ? extractTitle(body, url.hostname) : url.hostname,
      text: text.slice(0, MAX_EXCERPT_CHARS),
    };
  } catch (e) {
    console.error(`[research-gap-finder] failed to fetch external source ${rawUrl}:`, e);
    return null;
  }
}

export interface ExternalSourceInput {
  url: string;
  /** Bibliographic metadata from the open-data source search (see
   * src/app/api/discover/route.ts) — used as a fallback excerpt when the
   * live page can't be fetched/read (paywall, non-HTML response, etc.),
   * so a search result a researcher picked doesn't just silently vanish
   * from the analysis. Always real data from the source's own record,
   * never fabricated. */
  title?: string;
  authors?: string;
  year?: number | null;
  venue?: string | null;
}

/**
 * Validates a request body's raw external-sources array into
 * ExternalSourceInput[] — accepts either a bare URL string (manual
 * paste) or a {url, title, authors, year, venue} object (a discovery-
 * search result, see src/app/api/discover/route.ts). Shared by both API
 * routes that accept external sources so the parsing rules stay
 * identical.
 */
export function parseExternalSources(raw: unknown, limit: number): ExternalSourceInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): ExternalSourceInput | null => {
      if (typeof item === "string") return item.trim() ? { url: item.trim() } : null;
      if (item && typeof item === "object" && typeof (item as any).url === "string" && (item as any).url.trim()) {
        const o = item as any;
        return {
          url: o.url.trim(),
          title: typeof o.title === "string" ? o.title : undefined,
          authors: typeof o.authors === "string" ? o.authors : undefined,
          year: typeof o.year === "number" ? o.year : null,
          venue: typeof o.venue === "string" ? o.venue : null,
        };
      }
      return null;
    })
    .filter((s): s is ExternalSourceInput => s !== null)
    .slice(0, limit);
}

/**
 * Resolves one external source: fetches real page text when possible,
 * else falls back to the caller-supplied bibliographic metadata (if any
 * was provided — e.g. from a discovery-search result), else reports it
 * as skipped. Shared by findResearchGaps and draftSystematicReview so
 * both tools handle a failed fetch the same honest way.
 */
export async function resolveExternalSource(
  input: ExternalSourceInput
): Promise<{ source: GapAnalysisSource } | { skipped: { url: string; reason: string } }> {
  const fetched = await fetchExternalSource(input.url);
  if (fetched) {
    const title = fetched.title || input.title || fetched.url;
    return {
      source: {
        kind: "external",
        id: fetched.url,
        title,
        excerpt: fetched.text,
        matrix: { ...blankMatrixFields(), reference: formatApaReferenceExternal(input, title) },
      },
    };
  }
  const metaExcerpt = [input.authors, input.year, input.venue].filter(Boolean).join(" · ");
  if (input.title && metaExcerpt) {
    return {
      source: {
        kind: "external",
        id: input.url,
        title: input.title,
        excerpt: `${input.title} — ${metaExcerpt}`,
        matrix: { ...blankMatrixFields(), reference: formatApaReferenceExternal(input, input.title) },
      },
    };
  }
  return { skipped: { url: input.url, reason: "Could not fetch or read this URL as text/HTML" } };
}

/**
 * One matrix cell: the extracted value, plus the verbatim quote the model
 * claims proves it — verified server-side (see verifyQuote below) rather
 * than trusted outright, the same "don't take the LLM's word for its own
 * accuracy" posture Scite.ai built a whole product around for citations.
 * `verified: true` also for the trivial case of an empty value/quote (the
 * "Not stated..." sentence has nothing to verify against).
 */
export interface FieldWithEvidence {
  value: string;
  quote: string;
  verified: boolean;
}

/**
 * The standard literature-review-matrix dimensions researchers compare
 * across included studies. The nine qualitative fields are LLM-extracted
 * strictly from each source's own excerpt (never inferred), and each now
 * carries a verbatim supporting quote that's programmatically checked
 * against that source's own excerpt — `reference` is never LLM-generated
 * at all: it's built deterministically, reusing the platform's own APA 7
 * formatter (src/lib/article.ts's formatCitation()) for internal
 * articles, and a best-effort equivalent from real discovery-search
 * metadata for external ones — so citation accuracy never depends on the
 * model getting punctuation right.
 */
export interface SourceMatrixEntry {
  researchDesign: FieldWithEvidence;
  participants: FieldWithEvidence;
  population: FieldWithEvidence;
  locale: FieldWithEvidence;
  theoreticalFramework: FieldWithEvidence;
  methodology: FieldWithEvidence;
  keyFindings: FieldWithEvidence;
  conclusions: FieldWithEvidence;
  recommendations: FieldWithEvidence;
  /** APA 7th-edition formatted reference — always populated, independent
   * of whether the LLM ran at all. */
  reference: string;
}

function blankField(): FieldWithEvidence {
  return { value: "", quote: "", verified: false };
}

/** The nine qualitative fields are blank (not "Not stated") until the LLM
 * actually examines the source — a blank means "not yet analyzed", a
 * literal "Not stated in the source material provided." (the model's own
 * words, per the prompt) means "the model looked and it genuinely isn't
 * there". Different meanings, both honestly distinguishable in the UI. */
function blankMatrixFields(): Omit<SourceMatrixEntry, "reference"> {
  return {
    researchDesign: blankField(),
    participants: blankField(),
    population: blankField(),
    locale: blankField(),
    theoreticalFramework: blankField(),
    methodology: blankField(),
    keyFindings: blankField(),
    conclusions: blankField(),
    recommendations: blankField(),
  };
}

const NOT_STATED = "Not stated in the source material provided.";
/** Minimum quote length worth checking — below this almost any quote
 * would trivially appear somewhere in a 3000-char excerpt by chance, so a
 * too-short quote is treated as unverifiable rather than falsely "verified". */
const MIN_VERIFIABLE_QUOTE_CHARS = 12;

function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Deterministic claim verification: does the model's claimed supporting
 * quote actually appear (near-verbatim) in the source's own excerpt? This
 * is the Scite.ai-style "don't just trust the citation, check it"
 * mechanism, applied here to matrix-field extraction instead of citation
 * classification. A missing/too-short quote against a real (non-"not
 * stated") value is honestly unverified rather than assumed correct.
 */
export function verifyQuote(value: string, quote: string, sourceExcerpt: string): boolean {
  if (!value.trim() || value.trim() === NOT_STATED) return true;
  const normalizedQuote = normalizeForMatch(quote);
  if (normalizedQuote.length < MIN_VERIFIABLE_QUOTE_CHARS) return false;
  return normalizeForMatch(sourceExcerpt).includes(normalizedQuote);
}

/** Formats a discovery-search "First Last, First Last" author string into
 * APA 7's "Last, F. M., & Last, F. M." form. Best-effort — external
 * sources don't carry structured given/family name parts the way this
 * platform's own author records do, so this is a real but approximate
 * equivalent of formatCitation()'s internal-article logic, not a
 * guarantee of perfect APA name order for every source. */
function formatApaAuthorsFromString(authorsStr: string | undefined): string {
  if (!authorsStr?.trim()) return "";
  const names = authorsStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((n) => {
      const parts = n.replace(/^Dr\.?\s+|^Prof\.?\s+/, "").trim().split(/\s+/);
      if (parts.length < 2) return n;
      const last = parts[parts.length - 1];
      const initials = parts
        .slice(0, -1)
        .map((p) => p.charAt(0))
        .filter(Boolean)
        .join(". ") + ".";
      return `${last}, ${initials}`;
    });
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return names.slice(0, -1).join(", ") + ", & " + names[names.length - 1];
}

/** Best-effort APA 7 reference for an external source, built only from
 * real metadata the discovery search or the researcher actually
 * supplied — an undated/unauthored web source still gets a valid APA
 * "(n.d.)" citation rather than an invented author or year. */
function formatApaReferenceExternal(input: ExternalSourceInput, resolvedTitle: string): string {
  const authors = formatApaAuthorsFromString(input.authors);
  const year = input.year ? `(${input.year}).` : "(n.d.).";
  const title = resolvedTitle.replace(/\.+$/, "");
  const venue = input.venue ? ` ${input.venue}.` : "";
  const link = input.url ? ` ${input.url}` : "";
  const authorPart = authors ? `${authors} ` : "";
  return `${authorPart}${year} ${title}.${venue}${link}`.replace(/\s+/g, " ").trim();
}

export interface GapAnalysisSource {
  kind: "internal" | "external";
  id: string; // articleId for internal, the resolved URL for external
  title: string;
  excerpt: string;
  matrix: SourceMatrixEntry;
}

/**
 * Resolves this platform's own published articles into GapAnalysisSource
 * rows — real APA 7 reference via formatCitation(), same as the article
 * page's own Cite panel. Shared by findResearchGaps and
 * draftSystematicReview so both tools cite internal articles identically.
 */
export async function fetchInternalSources(articleIds: string[]): Promise<GapAnalysisSource[]> {
  if (articleIds.length === 0) return [];
  const articles = await db.article.findMany({
    where: { id: { in: articleIds }, status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      abstract: true,
      authors: true,
      publishedAt: true,
      doi: true,
      journal: { select: { name: true } },
      issue: { select: { volume: true, issueNumber: true } },
    },
  });
  return articles.map((a) => ({
    kind: "internal" as const,
    id: a.id,
    title: a.title,
    excerpt: a.abstract.slice(0, MAX_EXCERPT_CHARS),
    matrix: {
      ...blankMatrixFields(),
      reference: formatCitation({
        title: a.title,
        authors: a.authors,
        publishedAt: a.publishedAt,
        doi: a.doi,
        journalName: a.journal?.name,
        volume: a.issue?.volume,
        issueNumber: a.issue?.issueNumber,
      }),
    },
  }));
}

export interface ResearchGap {
  gap: string;
  explanation: string;
}

export interface GapAnalysisResult {
  sources: GapAnalysisSource[];
  /** A synthesis of what the sources collectively show and where they
   * diverge — always populated when mode is "llm", even in the rare case
   * the model finds no discrete gap worth naming, so a run never comes
   * back as bare silence. */
  overview: string;
  gaps: ResearchGap[];
  skippedUrls: { url: string; reason: string }[];
  mode: "llm" | "unavailable";
  /** Why mode is "unavailable" — lets the UI say something more honest
   * than a blanket "no LLM configured" when the real cause was a
   * transient call failure. Absent when mode is "llm". */
  reason?: "insufficient_sources" | "no_provider" | "call_failed";
  model?: string;
}

const GAP_ANALYSIS_SYSTEM_PROMPT =
  "You are a research assistant helping a scholar compare a set of sources in depth, in the standard literature-review-matrix format (research design, participants, population/sample, locale/setting, theoretical framework, methodology, key findings, conclusions, recommendations). Extract every matrix field strictly from what's stated in that source's own excerpt — write exactly 'Not stated in the source material provided.' for any field the excerpt doesn't actually address (and leave quote empty in that case); never infer, guess, or carry a detail over from a different source. For every other field, quote must be a short (under 200 characters) verbatim excerpt copied exactly from that source's own text that proves the value — not a paraphrase, not from a different source. Real academic sources on a shared topic almost always differ in population, context, methodology, scope, timeframe, or emphasis — your job in the gap analysis is to surface those differences concretely, not to look for a reason to say nothing. An empty gaps list is only appropriate when the sources are near-duplicates of each other (e.g. the same study indexed twice) — for any genuinely distinct set of sources, identify at least 2-3 concrete gaps: an angle only one source covers, a population/context none of them address, a methodological limitation shared across all of them, or an apparent contradiction between findings.";

export interface RawMatrixField {
  value: string;
  /** Verbatim excerpt from this source's own text supporting `value` —
   * empty string when `value` is the "Not stated..." sentence. */
  quote: string;
}

export interface RawSourceAnalysis {
  index: number;
  researchDesign: RawMatrixField;
  participants: RawMatrixField;
  population: RawMatrixField;
  locale: RawMatrixField;
  theoreticalFramework: RawMatrixField;
  methodology: RawMatrixField;
  keyFindings: RawMatrixField;
  conclusions: RawMatrixField;
  recommendations: RawMatrixField;
}

const FIELD_SHAPE = '{"value": "...", "quote": "<verbatim excerpt from this source proving the value, or empty string if the value is the not-stated sentence>"}';
export const SOURCE_ANALYSIS_FIELD_SCHEMA =
  `{"index": <1-based source number>, "researchDesign": ${FIELD_SHAPE}, "participants": ${FIELD_SHAPE}, "population": ${FIELD_SHAPE}, "locale": ${FIELD_SHAPE}, "theoreticalFramework": ${FIELD_SHAPE}, "methodology": ${FIELD_SHAPE}, "keyFindings": ${FIELD_SHAPE}, "conclusions": ${FIELD_SHAPE}, "recommendations": ${FIELD_SHAPE}}`;

const MATRIX_FIELD_KEYS = [
  "researchDesign",
  "participants",
  "population",
  "locale",
  "theoreticalFramework",
  "methodology",
  "keyFindings",
  "conclusions",
  "recommendations",
] as const;

/** Merges the LLM's per-source matrix analysis back onto the resolved
 * source list by index, verifying each field's claimed quote against that
 * source's own excerpt as it goes — shared shape/logic between
 * findResearchGaps and draftSystematicReview. */
export function mergeSourceAnalyses(sources: GapAnalysisSource[], analyses: RawSourceAnalysis[] | undefined): GapAnalysisSource[] {
  const byIndex = new Map((analyses ?? []).map((a) => [a.index, a]));
  return sources.map((s, i) => {
    const a = byIndex.get(i + 1);
    if (!a) return s;
    const matrix = { ...s.matrix };
    for (const key of MATRIX_FIELD_KEYS) {
      const raw = a[key];
      const value = raw?.value ?? "";
      const quote = raw?.quote ?? "";
      matrix[key] = { value, quote, verified: verifyQuote(value, quote, s.excerpt) };
    }
    return { ...s, matrix };
  });
}

/** One retry on a transient failure (rate limit, momentary network error)
 * before giving up — chatJSON() already retries across tiers internally,
 * this covers the case where the same transient condition affects both.
 * Exported so prisma-draft.ts shares the exact same retry policy. */
export async function chatJSONWithRetry<T>(system: string, user: string, maxTokens: number): Promise<{ data: T; model: string }> {
  try {
    return await chatJSON<T>(system, user, { maxTokens, priority: "cost-first" });
  } catch (firstError) {
    await new Promise((r) => setTimeout(r, 750));
    try {
      return await chatJSON<T>(system, user, { maxTokens, priority: "cost-first" });
    } catch (secondError) {
      console.error("[research-gap-finder] retry also failed:", secondError);
      throw secondError;
    }
  }
}

export async function findResearchGaps(input: {
  internalArticleIds: string[];
  externalSources: ExternalSourceInput[];
}): Promise<GapAnalysisResult> {
  const sources: GapAnalysisSource[] = await fetchInternalSources(input.internalArticleIds);
  const skippedUrls: { url: string; reason: string }[] = [];

  for (const ext of input.externalSources) {
    const resolved = await resolveExternalSource(ext);
    if ("source" in resolved) sources.push(resolved.source);
    else skippedUrls.push(resolved.skipped);
  }

  if (sources.length < 2) {
    return { sources, overview: "", gaps: [], skippedUrls, mode: "unavailable", reason: "insufficient_sources" };
  }
  if (!anyLLMAvailable()) {
    return { sources, overview: "", gaps: [], skippedUrls, mode: "unavailable", reason: "no_provider" };
  }

  try {
    const sourceList = sources.map((s, i) => `[${i + 1}] ${s.title}\n${s.excerpt}`).join("\n\n---\n\n");
    const { data, model } = await chatJSONWithRetry<{
      overview: string;
      sourceAnalyses: RawSourceAnalysis[];
      gaps: ResearchGap[];
    }>(
      GAP_ANALYSIS_SYSTEM_PROMPT,
      `Here are ${sources.length} sources on a related research area:\n\n${sourceList}\n\n` +
        `Respond with a single JSON object: {"overview": "<2-4 sentences synthesizing what these sources collectively ` +
        `show and where they diverge — always fill this in>", "sourceAnalyses": [<one entry per source, in order, ` +
        `each shaped exactly like ${SOURCE_ANALYSIS_FIELD_SCHEMA}>], "gaps": [{"gap": "<short label, one sentence>", ` +
        `"explanation": "<1-2 sentences grounded in the sources above>"}]}. Return at most 6 gaps.`,
      3800
    );
    return {
      sources: mergeSourceAnalyses(sources, data.sourceAnalyses),
      overview: data.overview?.trim() ?? "",
      gaps: data.gaps ?? [],
      skippedUrls,
      mode: "llm",
      model,
    };
  } catch (e) {
    console.error("[research-gap-finder] LLM call failed:", e);
    return { sources, overview: "", gaps: [], skippedUrls, mode: "unavailable", reason: "call_failed" };
  }
}
