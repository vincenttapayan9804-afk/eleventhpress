import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSimilarArticles } from "@/lib/manuscript-checks";
import { getOrGenerateRelationExplanation } from "@/lib/related-explanation";

/**
 * GET /api/articles/[id]/similar?limit=3
 *
 * Real embedding-similarity-ranked recommendations, replacing the article
 * page's previous same-discipline lookup with genuine "articles like this
 * one" (src/lib/manuscript-checks.ts's getSimilarArticles(), the
 * reader-facing counterpart to the submission pipeline's checkSimilarity()
 * plagiarism check — same corpus, same embeddings, opposite purpose).
 * Public — same as every other published-article endpoint.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 3, 1), 10);

  const ranked = await getSimilarArticles(id, limit);
  if (ranked.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const rows = await db.article.findMany({
    where: { id: { in: ranked.map((r) => r.articleId) }, status: "PUBLISHED" },
    select: { id: true, title: true, discipline: true, citations: true, views: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const matched = ranked.map((r) => byId.get(r.articleId)).filter((r): r is NonNullable<typeof r> => !!r);

  // Best-effort, cached per pair (src/lib/related-explanation.ts) — never
  // lets a slow/unavailable LLM call block the recommendations themselves.
  const items = await Promise.all(
    matched.map(async (article) => {
      const { explanation } = await getOrGenerateRelationExplanation(id, article.id).catch(() => ({ explanation: "" }));
      return { ...article, whyRelated: explanation };
    })
  );

  return NextResponse.json({ items });
}
