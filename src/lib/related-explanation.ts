/**
 * AI-generated one-sentence explanation of why a recommended article is
 * relevant to the one a reader is looking at — cached per (articleId,
 * relatedArticleId) pair in ArticleSimilarityExplanation, since the
 * underlying embedding-similarity ranking (getSimilarArticles,
 * manuscript-checks.ts) is deterministic for a given corpus snapshot, and
 * reused by both the article page's "Continue reading" and the logged-in
 * reader's "Recommended for you" digest (src/lib/recommendations.ts) — no
 * need to regenerate the same explanation for both surfaces.
 *
 * Cost-first (Phase A) — a wrong or missing explanation doesn't affect an
 * editorial decision, just a recommendation's copy. No heuristic fallback:
 * a plausible-sounding but wrong reason is actively misleading, worse than
 * showing nothing (same reasoning as GlossaryResult) — so a failed
 * generation is never persisted, only real "llm" results are, which means
 * a cache miss naturally retries on the next read or backfill run rather
 * than being permanently stuck once a provider becomes available.
 */
import { db } from "@/lib/db";
import { anyLLMAvailable, chatJSON } from "@/lib/llm";

export interface RelationExplanation {
  explanation: string;
  mode: "llm" | "unavailable";
  model: string;
}

const SYSTEM_PROMPT = `You write a single, concise sentence explaining why one academic article would interest a reader of another. Read both abstracts and identify the genuine connection — shared method, related question, complementary finding, same subfield — in plain language a non-specialist could follow.

Respond with a single JSON object (no markdown, no preamble): {"explanation": "<one sentence, no more than 25 words>"}

Never invent a connection that isn't actually supported by both abstracts.`;

export async function explainRelation(
  article: { title: string; abstract: string },
  relatedArticle: { title: string; abstract: string }
): Promise<RelationExplanation> {
  if (anyLLMAvailable()) {
    try {
      const { data, model } = await chatJSON<{ explanation: string }>(
        SYSTEM_PROMPT,
        `Article the reader is looking at: "${article.title}"\n${article.abstract}\n\nRecommended article: "${relatedArticle.title}"\n${relatedArticle.abstract}`,
        { maxTokens: 200, priority: "cost-first" }
      );
      if (data.explanation?.trim()) {
        return { explanation: data.explanation.trim(), mode: "llm", model };
      }
    } catch (e) {
      console.error("[related-explanation] LLM call failed:", e);
    }
  }
  return { explanation: "", mode: "unavailable", model: "unavailable" };
}

/**
 * Returns the cached explanation for (articleId, relatedArticleId) if one
 * exists, generating and persisting it (only when the generation actually
 * succeeded) on a cache miss. Fetches both articles' title/abstract itself
 * so callers only need the two ids.
 */
export async function getOrGenerateRelationExplanation(
  articleId: string,
  relatedArticleId: string
): Promise<RelationExplanation> {
  const cached = await db.articleSimilarityExplanation.findUnique({
    where: { articleId_relatedArticleId: { articleId, relatedArticleId } },
  });
  if (cached) {
    return { explanation: cached.explanation, mode: cached.mode as "llm" | "unavailable", model: cached.model };
  }

  const [article, relatedArticle] = await Promise.all([
    db.article.findUnique({ where: { id: articleId }, select: { title: true, abstract: true } }),
    db.article.findUnique({ where: { id: relatedArticleId }, select: { title: true, abstract: true } }),
  ]);
  if (!article || !relatedArticle) {
    return { explanation: "", mode: "unavailable", model: "unavailable" };
  }

  const result = await explainRelation(article, relatedArticle);
  if (result.mode === "llm") {
    await db.articleSimilarityExplanation.upsert({
      where: { articleId_relatedArticleId: { articleId, relatedArticleId } },
      create: { articleId, relatedArticleId, explanation: result.explanation, mode: result.mode, model: result.model },
      update: { explanation: result.explanation, mode: result.mode, model: result.model, generatedAt: new Date() },
    });
  }
  return result;
}
