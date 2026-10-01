import { chatJSON, anyLLMAvailable } from "@/lib/llm";

/**
 * Smart/qualitative citations (Scite.ai-style) — classifies how a citing
 * article uses a reference it resolved against OpenAlex (src/lib/
 * citations.ts), run immediately after validation succeeds (see POST
 * /api/articles/[id]/references/validate). Never asserted as fact when
 * the model didn't actually answer: no LLM configured or a malformed/
 * out-of-vocabulary response both degrade to `null`, never a guess.
 */

export type CitationClassification = "SUPPORTING" | "CONTRASTING" | "MENTIONING";

const VALID_CLASSIFICATIONS: CitationClassification[] = ["SUPPORTING", "CONTRASTING", "MENTIONING"];

export interface ClassifyCitationResult {
  classification: CitationClassification | null;
  mode: "llm" | "unavailable";
}

const SYSTEM_PROMPT = `You classify how a citing paper uses a single reference it cites, for a scholarly citation-graph feature. Given the citing article's title/abstract and the cited reference, classify the citation as exactly one of:
- SUPPORTING: the citing work's findings corroborate, build on, replicate, or are consistent with the cited work
- CONTRASTING: the citing work's findings conflict with, refute, qualify, or are inconsistent with the cited work
- MENTIONING: a neutral background/contextual citation with no clear supporting or contrasting relationship

You only have the citing article's own title/abstract and the cited work's title to go on — the reference text itself never states which way it was actually used, so make the best-supported inference from that context rather than defaulting to MENTIONING out of caution. Respond with strict JSON: {"classification": "SUPPORTING" | "CONTRASTING" | "MENTIONING"}`;

export async function classifyCitation(params: {
  citingTitle: string;
  citingAbstract: string;
  referenceText: string;
  resolvedTitle?: string | null;
}): Promise<ClassifyCitationResult> {
  if (!anyLLMAvailable()) {
    return { classification: null, mode: "unavailable" };
  }

  const userPrompt = `Citing article:\nTitle: ${params.citingTitle}\nAbstract: ${params.citingAbstract}\n\nCited reference:\n${params.resolvedTitle || params.referenceText}`;

  try {
    const { data } = await chatJSON<{ classification: string }>(SYSTEM_PROMPT, userPrompt, {
      priority: "cost-first",
      maxTokens: 200,
    });
    const classification = (data.classification || "").toUpperCase() as CitationClassification;
    if (!VALID_CLASSIFICATIONS.includes(classification)) {
      return { classification: null, mode: "unavailable" };
    }
    return { classification, mode: "llm" };
  } catch {
    return { classification: null, mode: "unavailable" };
  }
}
