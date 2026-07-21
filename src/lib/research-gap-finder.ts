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
    return { source: { kind: "external", id: fetched.url, title: fetched.title || input.title || fetched.url, excerpt: fetched.text } };
  }
  const metaExcerpt = [input.authors, input.year, input.venue].filter(Boolean).join(" · ");
  if (input.title && metaExcerpt) {
    return {
      source: { kind: "external", id: input.url, title: input.title, excerpt: `${input.title} — ${metaExcerpt}` },
    };
  }
  return { skipped: { url: input.url, reason: "Could not fetch or read this URL as text/HTML" } };
}

export interface GapAnalysisSource {
  kind: "internal" | "external";
  id: string; // articleId for internal, the resolved URL for external
  title: string;
  excerpt: string;
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
  "You are a research assistant helping a scholar compare a set of sources in depth. Real academic sources on a shared topic almost always differ in population, context, methodology, scope, timeframe, or emphasis — your job is to surface those differences concretely, not to look for a reason to say nothing. Ground every observation in specific evidence from the sources provided; never invent a finding, statistic, or claim that isn't actually in the material. An empty gaps list is only appropriate when the sources are near-duplicates of each other (e.g. the same study indexed twice) — for any genuinely distinct set of sources, identify at least 2-3 concrete gaps: an angle only one source covers, a population/context none of them address, a methodological limitation shared across all of them, or an apparent contradiction between findings.";

/** One retry on a transient failure (rate limit, momentary network error)
 * before giving up — chatJSON() already retries across tiers internally,
 * this covers the case where the same transient condition affects both. */
async function chatJSONWithRetry<T>(system: string, user: string, maxTokens: number): Promise<{ data: T; model: string }> {
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
  const sources: GapAnalysisSource[] = [];
  const skippedUrls: { url: string; reason: string }[] = [];

  if (input.internalArticleIds.length > 0) {
    const articles = await db.article.findMany({
      where: { id: { in: input.internalArticleIds }, status: "PUBLISHED" },
      select: { id: true, title: true, abstract: true },
    });
    for (const a of articles) {
      sources.push({ kind: "internal", id: a.id, title: a.title, excerpt: a.abstract.slice(0, MAX_EXCERPT_CHARS) });
    }
  }

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
    const { data, model } = await chatJSONWithRetry<{ overview: string; gaps: ResearchGap[] }>(
      GAP_ANALYSIS_SYSTEM_PROMPT,
      `Here are ${sources.length} sources on a related research area:\n\n${sourceList}\n\n` +
        `Respond with a single JSON object: {"overview": "<2-4 sentences synthesizing what these sources collectively ` +
        `show and where they diverge — always fill this in>", "gaps": [{"gap": "<short label, one sentence>", ` +
        `"explanation": "<1-2 sentences grounded in the sources above>"}]}. Return at most 6 gaps.`,
      1800
    );
    return { sources, overview: data.overview?.trim() ?? "", gaps: data.gaps ?? [], skippedUrls, mode: "llm", model };
  } catch (e) {
    console.error("[research-gap-finder] LLM call failed:", e);
    return { sources, overview: "", gaps: [], skippedUrls, mode: "unavailable", reason: "call_failed" };
  }
}
