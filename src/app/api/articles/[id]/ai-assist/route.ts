import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { suggestKeywordsAndSummary } from "@/lib/manuscript-checks";

/**
 * POST /api/articles/[id]/ai-assist
 * Generates a lay summary and suggested keywords via src/lib/manuscript-checks.ts.
 * Corresponding author or an editor may trigger this; results are stored but
 * never applied automatically — the author/editor reviews and applies them.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const article = await db.article.findUnique({ where: { id } });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const isEditor = ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(session.role);
  const isOwner = article.correspondingAuthorId === session.userId;
  if (!isEditor && !isOwner) {
    return NextResponse.json({ error: "Not authorized for this article" }, { status: 403 });
  }

  const result = await suggestKeywordsAndSummary({
    title: article.title,
    abstract: article.abstract,
    keywords: article.keywords,
  });

  await db.article.update({
    where: { id },
    data: {
      laySummary: result.laySummary,
      aiKeywordSuggestions: JSON.stringify(result.suggestedKeywords),
    },
  });

  return NextResponse.json(result);
}
