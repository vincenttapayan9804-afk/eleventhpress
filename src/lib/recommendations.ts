/**
 * "Recommended for you" — a genuinely personalized reading digest for
 * logged-in readers, built from their own ReadingHistory (populated by
 * src/app/api/articles/[id]/route.ts on every article view) rather than a
 * generic "popular articles" list. Reuses getSimilarArticles()
 * (manuscript-checks.ts) against each of the reader's most recently read
 * articles, so the recommendation is grounded in real embedding
 * similarity to what they've actually read — not a fabricated ranking.
 *
 * Readers with no reading history yet get an empty digest (never a
 * fallback to generic "popular" content presented as if it were
 * personalized) — callers should show an honest empty state.
 */
import { db } from "@/lib/db";
import { getSimilarArticles } from "@/lib/manuscript-checks";
import { getOrGenerateRelationExplanation } from "@/lib/related-explanation";

const RECENT_HISTORY_LOOKBACK = 3;

export interface RecommendedArticle {
  id: string;
  title: string;
  discipline: string;
  citations: number;
  views: number;
  becauseOf: string; // title of the read article this recommendation was derived from
  whyRelated: string; // AI-generated one-sentence explanation, "" if unavailable
}

export async function getRecommendationsForUser(
  userId: string,
  limit = 4
): Promise<RecommendedArticle[]> {
  const recent = await db.readingHistory.findMany({
    where: { userId },
    orderBy: { viewedAt: "desc" },
    take: RECENT_HISTORY_LOOKBACK,
    include: { article: { select: { id: true, title: true } } },
  });
  if (recent.length === 0) return [];

  const alreadyRead = new Set(recent.map((r) => r.articleId));
  const candidates = new Map<string, { score: number; becauseOf: string; becauseOfId: string }>();

  for (const entry of recent) {
    const similar = await getSimilarArticles(entry.articleId, limit);
    for (const s of similar) {
      if (alreadyRead.has(s.articleId)) continue;
      const existing = candidates.get(s.articleId);
      if (!existing || s.score > existing.score) {
        candidates.set(s.articleId, { score: s.score, becauseOf: entry.article.title, becauseOfId: entry.articleId });
      }
    }
  }

  const ranked = [...candidates.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, limit);
  if (ranked.length === 0) return [];

  const rows = await db.article.findMany({
    where: { id: { in: ranked.map(([id]) => id) }, status: "PUBLISHED" },
    select: { id: true, title: true, discipline: true, citations: true, views: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  const matched = ranked
    .map(([id, meta]) => {
      const article = byId.get(id);
      return article ? { ...article, becauseOf: meta.becauseOf, becauseOfId: meta.becauseOfId } : null;
    })
    .filter((r): r is NonNullable<typeof r> => !!r);

  // Best-effort, cached per pair (src/lib/related-explanation.ts) — never
  // lets a slow/unavailable LLM call block the digest itself.
  return Promise.all(
    matched.map(async ({ becauseOfId, ...rest }) => {
      const { explanation } = await getOrGenerateRelationExplanation(becauseOfId, rest.id).catch(() => ({ explanation: "" }));
      return { ...rest, whyRelated: explanation };
    })
  );
}
