import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

/**
 * POST /api/articles/[id]/decision-letter
 *
 * Attaches (or updates) a formatted, author-facing decision letter to an
 * existing EditorialDecision row — kept separate from that row's `note`
 * field, which stays a short internal-only note regardless of this call.
 * Editor/Associate Editor/Super Admin only.
 *
 * Body: { decisionId, letterBody, publish?: boolean }
 * `publish: true` sets letterPublishedAt, which is what makes the letter
 * appear on the public Review History tab
 * (src/app/api/articles/[id]/review-history/route.ts) — a letter can be
 * drafted (or sent to the author elsewhere) before that, same
 * draft-then-publish shape as every other transparency toggle in this
 * codebase (e.g. openReview).
 */
const MAX_LETTER_LENGTH = 20000;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

  const { id: articleId } = await params;
  const { decisionId, letterBody, publish } = (await req.json()) as {
    decisionId?: string;
    letterBody?: string;
    publish?: boolean;
  };

  const trimmed = (letterBody || "").trim();
  if (!decisionId || !trimmed) {
    return NextResponse.json({ error: "decisionId and letterBody are required" }, { status: 400 });
  }
  if (trimmed.length > MAX_LETTER_LENGTH) {
    return NextResponse.json({ error: `letterBody must be ${MAX_LETTER_LENGTH} characters or fewer` }, { status: 400 });
  }

  const decision = await db.editorialDecision.findUnique({ where: { id: decisionId } });
  if (!decision || decision.articleId !== articleId) {
    return NextResponse.json({ error: "Decision not found for this article" }, { status: 404 });
  }

  const article = await db.article.findUnique({
    where: { id: articleId },
    select: { title: true, correspondingAuthorId: true },
  });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const updated = await db.editorialDecision.update({
    where: { id: decisionId },
    data: {
      letterBody: trimmed,
      letterPublishedAt: publish ? new Date() : null,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: publish ? "DECISION_LETTER_PUBLISHED" : "DECISION_LETTER_DRAFTED",
      entityType: "ARTICLE",
      entityId: articleId,
      articleId,
      metadata: JSON.stringify({ decisionId }),
    },
  });

  if (publish && article.correspondingAuthorId) {
    await db.notification.create({
      data: {
        userId: article.correspondingAuthorId,
        type: "INFO",
        title: "Decision letter published",
        message: `The editor's decision letter for "${article.title}" is now visible on the article's Review History tab.`,
        articleId,
      },
    });
  }

  return NextResponse.json({
    decisionId: updated.id,
    letterPublishedAt: updated.letterPublishedAt,
  });
}
