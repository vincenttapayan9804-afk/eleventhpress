/**
 * Systematic Review / PRISMA drafting tool (Eleventh Research Lab) —
 * drafts a structured review scaffold (rationale, synthesis, limitations,
 * discussion points) from a researcher-selected set of "included
 * studies" — this platform's own published articles and/or external
 * sources (hand-pasted or picked from the open-data source search, see
 * src/app/api/discover/route.ts).
 *
 * Same real-or-nothing contract as research-gap-finder.ts: a fabricated
 * draft would waste a researcher's time worse than no draft at all, so
 * there's no heuristic fallback — mode is "llm" or "unavailable". Purely
 * advisory output into an editable field, same "AI suggests, human
 * decides" pattern as decision-letter-draft.ts — never auto-submitted or
 * treated as a finished review. Cost-first (free OpenRouter tier before
 * any billed Anthropic call) with a single retry on a transient failure —
 * same reliability fix as research-gap-finder.ts.
 */
import { db } from "@/lib/db";
import { chatJSON, anyLLMAvailable } from "@/lib/llm";
import { fetchExternalSource } from "@/lib/research-gap-finder";

const MAX_EXCERPT_CHARS = 3000;

export interface PrismaDraftSource {
  kind: "internal" | "external";
  id: string; // articleId for internal, the resolved URL for external
  title: string;
  excerpt: string;
}

export interface PrismaDraftResult {
  sources: PrismaDraftSource[];
  skippedUrls: { url: string; reason: string }[];
  draft: string;
  mode: "llm" | "unavailable";
  reason?: "insufficient_sources" | "no_provider" | "call_failed";
  model?: string;
}

const PRISMA_SYSTEM_PROMPT =
  "You are a research assistant helping a scholar draft the scaffold of a systematic review from a set of included studies. Ground every claim in the material provided — never invent a finding, statistic, or study detail that isn't in the source material. This is a first-draft scaffold for the researcher to revise, not a finished review.";

/** One retry on a transient failure before giving up — same fix as
 * research-gap-finder.ts's chatJSONWithRetry. */
async function chatJSONWithRetry<T>(system: string, user: string, maxTokens: number): Promise<{ data: T; model: string }> {
  try {
    return await chatJSON<T>(system, user, { maxTokens, priority: "cost-first" });
  } catch (firstError) {
    await new Promise((r) => setTimeout(r, 750));
    try {
      return await chatJSON<T>(system, user, { maxTokens, priority: "cost-first" });
    } catch (secondError) {
      console.error("[prisma-draft] retry also failed:", secondError);
      throw secondError;
    }
  }
}

export async function draftSystematicReview(input: {
  articleIds: string[];
  externalUrls: string[];
}): Promise<PrismaDraftResult> {
  const sources: PrismaDraftSource[] = [];
  const skippedUrls: { url: string; reason: string }[] = [];

  if (input.articleIds.length > 0) {
    const articles = await db.article.findMany({
      where: { id: { in: input.articleIds }, status: "PUBLISHED" },
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

  if (sources.length === 0) {
    return { sources, skippedUrls, draft: "", mode: "unavailable", reason: "insufficient_sources" };
  }
  if (!anyLLMAvailable()) {
    return { sources, skippedUrls, draft: "", mode: "unavailable", reason: "no_provider" };
  }

  try {
    const list = sources.map((s, i) => `[${i + 1}] ${s.title}\n${s.excerpt}`).join("\n\n---\n\n");
    const { data, model } = await chatJSONWithRetry<{ draft: string }>(
      PRISMA_SYSTEM_PROMPT,
      `Draft a systematic-review scaffold from these ${sources.length} included studies:\n\n${list}\n\n` +
        `Respond with a single JSON object: {"draft": "<markdown-formatted draft>"}. The draft should have these ` +
        `sections: "## Rationale" (why this review area matters, grounded in the studies), "## Included Studies" ` +
        `(a markdown table: Title | Key Finding, one row per study), "## Synthesis of Findings" (what the studies ` +
        `agree or disagree on), "## Limitations" (gaps or weaknesses evident across the set), and ` +
        `"## Suggested Discussion Points" (a bulleted list). Note in the Rationale section that a search-strategy ` +
        `and formal eligibility-criteria section still needs to be written by hand — this draft only covers the ` +
        `studies actually provided.`,
      3000
    );
    const draft = data.draft?.trim() ?? "";
    return draft
      ? { sources, skippedUrls, draft, mode: "llm", model }
      : { sources, skippedUrls, draft: "", mode: "unavailable", reason: "call_failed" };
  } catch (e) {
    console.error("[prisma-draft] LLM call failed:", e);
    return { sources, skippedUrls, draft: "", mode: "unavailable", reason: "call_failed" };
  }
}
