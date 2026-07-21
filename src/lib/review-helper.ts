/**
 * First-pass, advisory-only AI check of a reviewer's in-progress report —
 * flags obviously missing sections (no comment on methodology, a REJECT/
 * MAJOR_REVISIONS recommendation with no clear rationale, etc.) before
 * they submit. Cost-first (Phase A) — a missed or overly cautious
 * suggestion just means one fewer nudge, never blocks or edits the
 * reviewer's actual submission. The reviewer stays in full control: this
 * only ever returns suggestions for a human to read and dismiss, matching
 * this codebase's "AI suggests, human decides" pattern
 * (suggestKeywordsAndSummary, generateGlossary, etc.). Unlike glossary.ts,
 * a wrong nudge here is low-stakes (worst case, an irrelevant suggestion
 * the reviewer ignores) rather than misleading, so this keeps the
 * deterministic heuristic fallback the rest of manuscript-checks.ts uses
 * instead of an "unavailable" state.
 */
import { anyLLMAvailable, chatJSON } from "@/lib/llm";

export interface ReviewCompletenessResult {
  suggestions: string[];
  mode: "llm" | "heuristic";
  model: string;
}

const SYSTEM_PROMPT = `You help peer reviewers write a more complete report before they submit it. Read their draft comments to the author and the recommendation they selected, and point out anything an editor would typically expect but that seems to be missing — for example: no comment on methodology or study design, a REJECT or MAJOR_REVISIONS recommendation with no specific rationale given, no mention of whether the literature review is adequate, or vague comments with no actionable detail.

Respond with a single JSON object (no markdown, no preamble):
{"suggestions": ["<short, specific, actionable suggestion>", ...]}

Give at most 4 suggestions. If the review already looks reasonably complete, return {"suggestions": []}. Never invent a problem that isn't actually supported by the text.`;

export async function checkReviewCompleteness(input: {
  commentsToAuthor: string;
  recommendation: string;
}): Promise<ReviewCompletenessResult> {
  if (anyLLMAvailable()) {
    try {
      const { data, model } = await chatJSON<{ suggestions: string[] }>(
        SYSTEM_PROMPT,
        `Recommendation: ${input.recommendation || "(not yet selected)"}\n\nComments to the author:\n${input.commentsToAuthor || "(empty)"}`,
        { maxTokens: 500, priority: "cost-first" }
      );
      return { suggestions: (data.suggestions ?? []).slice(0, 4), mode: "llm", model };
    } catch (e) {
      console.error("[review-helper] LLM call failed, falling back to heuristic:", e);
    }
  }
  return { suggestions: heuristicCompletenessCheck(input), mode: "heuristic", model: "heuristic-fallback" };
}

const METHOD_KEYWORDS = /method|design|sample|data|approach|procedure/i;

function heuristicCompletenessCheck(input: { commentsToAuthor: string; recommendation: string }): string[] {
  const suggestions: string[] = [];
  const text = input.commentsToAuthor || "";
  if (text.trim().length < 100) {
    suggestions.push("Your comments to the author are quite short — consider adding more specific, actionable detail.");
  }
  if (!METHOD_KEYWORDS.test(text)) {
    suggestions.push("Your comments don't appear to mention methodology, study design, or data — consider whether that should be addressed.");
  }
  if ((input.recommendation === "REJECT" || input.recommendation === "MAJOR_REVISIONS") && text.trim().length < 200) {
    suggestions.push(
      `A "${input.recommendation.replace("_", " ").toLowerCase()}" recommendation typically benefits from a more detailed rationale.`
    );
  }
  return suggestions;
}
