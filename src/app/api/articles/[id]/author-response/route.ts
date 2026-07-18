import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

/**
 * POST /api/articles/[id]/author-response
 *
 * Lets the corresponding author record a response to reviewers for the
 * current revision round — one AuthorResponse entry per round, addressing
 * that round's reviews together (mirrors EditorialDecision's shape).
 * Feeds the transparent Review History tab
 * (src/app/api/articles/[id]/review-history/route.ts) when the article's
 * anonymizedReviewHistory is enabled; the response is stored regardless of
 * that flag, so an editor can turn transparency on later without losing
 * history.
 *
 * Corresponding author (or SUPER_ADMIN) only — matches the existing
 * "corresponding author can act on their own article" precedent in
 * src/lib/article-delete.ts.
 */
const MAX_RESPONSE_LENGTH = 20000;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id: articleId } = await params;
  const article = await db.article.findUnique({
    where: { id: articleId },
    select: { id: true, correspondingAuthorId: true, title: true },
  });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const isCorrespondingAuthor = session.userId === article.correspondingAuthorId;
  if (!isCorrespondingAuthor && session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Only the corresponding author can respond to reviewers" }, { status: 403 });
  }

  const { content } = (await req.json()) as { content?: string };
  const trimmed = (content || "").trim();
  if (!trimmed) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (trimmed.length > MAX_RESPONSE_LENGTH) {
    return NextResponse.json({ error: `content must be ${MAX_RESPONSE_LENGTH} characters or fewer` }, { status: 400 });
  }

  const response = await db.authorResponse.create({
    data: {
      articleId,
      authorId: session.userId,
      content: trimmed,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "AUTHOR_RESPONSE_SUBMITTED",
      entityType: "ARTICLE",
      entityId: articleId,
      articleId,
      metadata: JSON.stringify({ authorResponseId: response.id }),
    },
  });

  return NextResponse.json({ id: response.id, createdAt: response.createdAt });
}
