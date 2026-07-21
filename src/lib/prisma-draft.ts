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
import { resolveExternalSource, type ExternalSourceInput } from "@/lib/research-gap-finder";

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
  "You are a research assistant helping a scholar draft the scaffold of a systematic review from a set of included studies. Ground every claim in the material provided — never invent a finding, statistic, or study detail that isn't in the source material. This is a first-draft scaffold for the researcher to revise, not a finished review. Every section must be substantive, not a placeholder: real studies on a shared topic almost always differ in population, context, methodology, scope, timeframe, or emphasis, so 'Synthesis of Findings' and 'Limitations' should surface concrete differences and weaknesses rather than defaulting to generic statements like 'no significant differences were found' or 'no limitations identified' — only say that if the material genuinely gives no basis for anything more specific.";

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
  externalSources: ExternalSourceInput[];
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

  for (const ext of input.externalSources) {
    const resolved = await resolveExternalSource(ext);
    if ("source" in resolved) sources.push(resolved.source);
    else skippedUrls.push(resolved.skipped);
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
        `(a markdown table: Title | Key Finding, one row per study — the Key Finding column must cite something ` +
        `specific from that study's own material, not a generic restatement of the title), "## Synthesis of Findings" ` +
        `(at least 2-3 concrete points of agreement, disagreement, or differing scope/population/methodology across ` +
        `the studies), "## Limitations" (at least 2-3 concrete gaps or weaknesses evident across the set — e.g. ` +
        `population, geography, timeframe, or methodology the studies share or leave unaddressed), and ` +
        `"## Suggested Discussion Points" (a bulleted list of at least 3 items a researcher could pursue next). ` +
        `Note in the Rationale section that a search-strategy and formal eligibility-criteria section still needs ` +
        `to be written by hand — this draft only covers the studies actually provided.`,
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
