/**
 * AI-generated glossary of complex/technical terminology used in an
 * article — feeds the Supplemental Materials tab's "Inline definitions"
 * section. Follows this codebase's established real-LLM-plus-honest-
 * fallback pattern (src/lib/manuscript-checks.ts's suggestKeywordsAndSummary/
 * translateAbstract), but unlike those, there is no honest heuristic
 * fallback at all here: a plausible-sounding but wrong definition of a
 * technical term is actively harmful to a reader trying to understand the
 * paper, worse than showing nothing. So when the LLM is unavailable or the
 * call fails, this returns an empty glossary tagged mode: "unavailable" —
 * callers MUST show an explicit "not available" state, never an empty
 * list styled as "this article has no complex terms."
 *
 * Auto-generated once, at galley-generation/publish time (not
 * editor-triggered like the rest of this file's AI features) — the one
 * deliberate exception to this codebase's "AI content is always
 * human-triggered" convention, per explicit product decision.
 */
import { anyLLMAvailable, chatJSON } from "@/lib/llm";

export interface GlossaryTerm {
  term: string;
  definition: string;
}

export interface GlossaryResult {
  terms: GlossaryTerm[];
  mode: "llm" | "unavailable";
  model: string;
  generatedAt: string;
}

const GLOSSARY_SYSTEM_PROMPT = `You identify complex, discipline-specific, or jargon terminology in an academic abstract that a general educated reader (an undergraduate outside the field, a journalist, a policy reader) would likely need defined, and write concise, accurate, plain-language definitions.

Respond with a single JSON object (no markdown, no preamble):
{"terms": [{"term": "<the term or short phrase exactly as it appears>", "definition": "<1-2 plain-language sentences>"}]}

Identify 4-10 terms. Skip terms that are already common knowledge outside the field. Never invent a term that doesn't appear in the text.`;

export async function generateGlossary(article: {
  title: string;
  abstract: string;
  keywords: string;
  discipline: string;
}): Promise<GlossaryResult> {
  const generatedAt = new Date().toISOString();
  if (anyLLMAvailable()) {
    try {
      const { data, model } = await chatJSON<{ terms: GlossaryTerm[] }>(
        GLOSSARY_SYSTEM_PROMPT,
        `Discipline: ${article.discipline}\n\nTitle: ${article.title}\n\nAbstract:\n${article.abstract}\n\nKeywords: ${article.keywords || "(none)"}`,
        { maxTokens: 1500, priority: "cost-first" }
      );
      const terms = (data.terms ?? []).filter((t) => t.term?.trim() && t.definition?.trim());
      return { terms, mode: "llm", model, generatedAt };
    } catch (e) {
      console.error("[glossary] LLM call failed, glossary unavailable for this article:", e);
    }
  }
  return { terms: [], mode: "unavailable", model: "unavailable", generatedAt };
}
