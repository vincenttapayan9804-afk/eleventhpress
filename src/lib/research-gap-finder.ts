/**
 * Research Gap Finder (Eleventh Research Lab) — given a mix of this
 * platform's own published articles and researcher-pasted external URLs,
 * asks the LLM to identify genuine gaps: questions or angles none of the
 * sources address, or where their findings conflict.
 *
 * Real-or-nothing contract, same family as glossary.ts/
 * related-explanation.ts: a wrong-but-plausible "gap" would actively
 * mislead a researcher's actual work, so there is no heuristic fallback —
 * mode is "llm" or "unavailable", never fabricated. Quality-first (not
 * cost-first): this shapes real research direction, closer in stakes to
 * the decision-letter drafter than to a chat reply or translation.
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

interface FetchedSource {
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

async function fetchExternalSource(rawUrl: string): Promise<FetchedSource | null> {
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
    const text = isHtml ? htmlToPlainText(body) : body.replace(/\s+/g, " ").trim();
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
  gaps: ResearchGap[];
  skippedUrls: { url: string; reason: string }[];
  mode: "llm" | "unavailable";
  model?: string;
}

const GAP_ANALYSIS_SYSTEM_PROMPT =
  "You are a research assistant helping a scholar identify genuine gaps in a set of sources: questions or angles none of them address, or points where their findings conflict. Ground every gap in specific evidence from the sources provided — never invent a gap that isn't actually supported by what's missing or conflicting in the material. If you can't identify any genuine gap, return an empty array rather than manufacture one.";

export async function findResearchGaps(input: {
  internalArticleIds: string[];
  externalUrls: string[];
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

  for (const rawUrl of input.externalUrls) {
    const fetched = await fetchExternalSource(rawUrl);
    if (fetched) {
      sources.push({ kind: "external", id: fetched.url, title: fetched.title, excerpt: fetched.text });
    } else {
      skippedUrls.push({ url: rawUrl, reason: "Could not fetch or read this URL as text/HTML" });
    }
  }

  if (sources.length < 2 || !anyLLMAvailable()) {
    return { sources, gaps: [], skippedUrls, mode: "unavailable" };
  }

  try {
    const sourceList = sources.map((s, i) => `[${i + 1}] ${s.title}\n${s.excerpt}`).join("\n\n---\n\n");
    const { data, model } = await chatJSON<{ gaps: ResearchGap[] }>(
      GAP_ANALYSIS_SYSTEM_PROMPT,
      `Here are ${sources.length} sources on a related research area:\n\n${sourceList}\n\nRespond with a single JSON object: {"gaps": [{"gap": "<short label, one sentence>", "explanation": "<1-2 sentences grounded in the sources above>"}]}. Return at most 6 gaps.`,
      { maxTokens: 1400 }
    );
    return { sources, gaps: data.gaps ?? [], skippedUrls, mode: "llm", model };
  } catch (e) {
    console.error("[research-gap-finder] LLM call failed:", e);
    return { sources, gaps: [], skippedUrls, mode: "unavailable" };
  }
}
