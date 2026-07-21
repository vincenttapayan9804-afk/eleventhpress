/**
 * Drafts a starting-point decision letter to a manuscript's corresponding
 * author, for an editor to review and edit before anything is sent —
 * never sent or published automatically. Feeds the existing decision
 * letter composer (src/components/dashboard/editor-queue-tab.tsx), which
 * already requires an explicit "Publish letter" click
 * (src/app/api/articles/[id]/decision-letter/route.ts) — this only
 * pre-fills that textarea, it doesn't add a new send path. Cost-first
 * (Phase A). No heuristic fallback: a generic-sounding but fabricated
 * boilerplate letter is worse than an honest "AI draft unavailable" —
 * same reasoning as glossary.ts — so on failure this returns an empty
 * letterBody tagged mode: "unavailable".
 */
import { anyLLMAvailable, chatJSON } from "@/lib/llm";

export interface DecisionLetterDraftResult {
  letterBody: string;
  mode: "llm" | "unavailable";
  model: string;
}

const DECISION_LABELS: Record<string, string> = {
  ACCEPT: "accepted for publication",
  REJECT: "not accepted for publication",
  REQUEST_REVISIONS: "sent back for revisions before a final decision",
};

const SYSTEM_PROMPT = `You draft a professional, honest decision letter from a journal editor to a manuscript's corresponding author. Match the tone to the decision: encouraging and clear for revisions, congratulatory but not effusive for acceptance, respectful and constructive for rejection — always give the author a clear sense of why, without inventing specific reviewer critiques that weren't provided to you.

Respond with a single JSON object (no markdown, no preamble): {"letterBody": "<the full letter text, starting with \"Dear author,\" and signed generically as \"The Editors\">"}

Keep it to 3-6 short paragraphs. If an internal editor note is provided, incorporate its substance into the letter in professional language — never quote it verbatim if it reads like an internal aside rather than author-facing feedback.`;

export async function draftDecisionLetter(input: {
  articleTitle: string;
  decisionAction: string;
  editorNote?: string;
}): Promise<DecisionLetterDraftResult> {
  if (anyLLMAvailable()) {
    try {
      const decisionLabel = DECISION_LABELS[input.decisionAction] ?? input.decisionAction.replace(/_/g, " ").toLowerCase();
      const { data, model } = await chatJSON<{ letterBody: string }>(
        SYSTEM_PROMPT,
        `Article title: "${input.articleTitle}"\nDecision: ${decisionLabel}\n${
          input.editorNote ? `Internal editor note (for context — do not quote verbatim): ${input.editorNote}` : "No internal note provided."
        }`,
        { maxTokens: 800, priority: "cost-first" }
      );
      if (data.letterBody?.trim()) {
        return { letterBody: data.letterBody.trim(), mode: "llm", model };
      }
    } catch (e) {
      console.error("[decision-letter-draft] LLM call failed:", e);
    }
  }
  return { letterBody: "", mode: "unavailable", model: "unavailable" };
}
