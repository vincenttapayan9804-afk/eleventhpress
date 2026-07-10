import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { semanticSearch } from "@/lib/embeddings";

/**
 * GET /api/search/semantic?q=<query>&limit=20
 *
 * Hybrid search: combines semantic (vector similarity) and lexical
 * (keyword ILIKE) search. Returns ranked results with a relevance score
 * and indicates which matching strategy was used.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const limit = Math.min(50, parseInt(searchParams.get("limit") || "20", 10));

  if (!q) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }

  // 1. Semantic search
  const semanticResults = await semanticSearch(q, { limit: limit * 2 });

  // 2. Lexical search (keyword)
  const lexicalArticles = await db.article.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { title: { contains: q } },
        { abstract: { contains: q } },
        { keywords: { contains: q } },
      ],
    },
    take: limit * 2,
    select: { id: true },
  });

  // 3. Merge and rank
  const scoreMap = new Map<string, { semantic: number; lexical: boolean }>();

  for (const r of semanticResults) {
    scoreMap.set(r.articleId, { semantic: r.score, lexical: false });
  }
  for (const a of lexicalArticles) {
    const existing = scoreMap.get(a.id);
    if (existing) {
      existing.lexical = true;
    } else {
      scoreMap.set(a.id, { semantic: 0, lexical: true });
    }
  }

  // Hybrid score: semantic * 0.7 + lexical * 0.3
  const ranked = Array.from(scoreMap.entries())
    .map(([articleId, scores]) => ({
      articleId,
      score: scores.semantic * 0.7 + (scores.lexical ? 0.3 : 0),
      semanticScore: scores.semantic,
      lexicalMatch: scores.lexical,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // 4. Fetch full article data
  const articleIds = ranked.map((r) => r.articleId);
  const articles = await db.article.findMany({
    where: { id: { in: articleIds } },
    include: { issue: true, journal: true },
  });

  const articleMap = new Map(articles.map((a) => [a.id, a]));
  const results = ranked
    .map((r) => {
      const a = articleMap.get(r.articleId);
      if (!a) return null;
      return {
        id: a.id,
        doi: a.doi,
        title: a.title,
        abstract: a.abstract,
        keywords: a.keywords,
        discipline: a.discipline,
        authors: a.authors,
        publishedAt: a.publishedAt,
        views: a.views,
        citations: a.citations,
        volume: a.issue?.volume ?? null,
        issueNumber: a.issue?.issueNumber ?? null,
        year: a.issue?.year ?? null,
        score: r.score,
        semanticScore: r.semanticScore,
        lexicalMatch: r.lexicalMatch,
        matchType:
          r.semanticScore > 0.3 && r.lexicalMatch ? "semantic+lexical" :
          r.semanticScore > 0.3 ? "semantic" :
          r.lexicalMatch ? "lexical" : "low",
      };
    })
    .filter(Boolean);

  return NextResponse.json({
    query: q,
    total: results.length,
    results,
  });
}
