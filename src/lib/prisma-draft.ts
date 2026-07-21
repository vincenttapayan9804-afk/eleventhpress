/**
 * Systematic Review / PRISMA drafting tool (Eleventh Research Lab) —
 * drafts a structured review scaffold (rationale, synthesis, limitations,
 * discussion points) from a researcher-selected set of this platform's
 * own published articles as the "included studies".
 *
 * Same real-or-nothing contract as research-gap-finder.ts: a fabricated
 * draft would waste a researcher's time worse than no draft at all, so
 * there's no heuristic fallback — mode is "llm" or "unavailable". Purely
 * advisory output into an editable field, same "AI suggests, human
 * decides" pattern as decision-letter-draft.ts — never auto-submitted or
 * treated as a finished review.
 */
import { db } from "@/lib/db";
import { chatJSON, anyLLMAvailable } from "@/lib/llm";

export interface PrismaDraftSource {
  articleId: string;
  title: string;
  abstract: string;
}

export interface PrismaDraftResult {
  sources: PrismaDraftSource[];
  draft: string;
  mode: "llm" | "unavailable";
  model?: string;
}

const PRISMA_SYSTEM_PROMPT =
  "You are a research assistant helping a scholar draft the scaffold of a systematic review from a set of included studies. Ground every claim in the abstracts provided — never invent a finding, statistic, or study detail that isn't in the source material. This is a first-draft scaffold for the researcher to revise, not a finished review.";

export async function draftSystematicReview(articleIds: string[]): Promise<PrismaDraftResult> {
  const articles = await db.article.findMany({
    where: { id: { in: articleIds }, status: "PUBLISHED" },
    select: { id: true, title: true, abstract: true },
  });
  const sources: PrismaDraftSource[] = articles.map((a) => ({ articleId: a.id, title: a.title, abstract: a.abstract }));

  if (sources.length === 0 || !anyLLMAvailable()) {
    return { sources, draft: "", mode: "unavailable" };
  }

  try {
    const list = sources.map((s, i) => `[${i + 1}] ${s.title}\n${s.abstract}`).join("\n\n---\n\n");
    const { data, model } = await chatJSON<{ draft: string }>(
      PRISMA_SYSTEM_PROMPT,
      `Draft a systematic-review scaffold from these ${sources.length} included studies:\n\n${list}\n\n` +
        `Respond with a single JSON object: {"draft": "<markdown-formatted draft>"}. The draft should have these ` +
        `sections: "## Rationale" (why this review area matters, grounded in the studies), "## Included Studies" ` +
        `(a markdown table: Title | Key Finding, one row per study), "## Synthesis of Findings" (what the studies ` +
        `agree or disagree on), "## Limitations" (gaps or weaknesses evident across the set), and ` +
        `"## Suggested Discussion Points" (a bulleted list). Note in the Rationale section that a search-strategy ` +
        `and formal eligibility-criteria section still needs to be written by hand — this draft only covers the ` +
        `studies actually provided.`,
      { maxTokens: 3000 }
    );
    const draft = data.draft?.trim() ?? "";
    return { sources, draft, mode: draft ? "llm" : "unavailable", model };
  } catch (e) {
    console.error("[prisma-draft] LLM call failed:", e);
    return { sources, draft: "", mode: "unavailable" };
  }
}
