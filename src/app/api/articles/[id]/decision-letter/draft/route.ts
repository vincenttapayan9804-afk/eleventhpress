import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { draftDecisionLetter } from "@/lib/decision-letter-draft";

/**
 * POST /api/articles/[id]/decision-letter/draft
 *
 * AI-drafts a starting point for the decision letter composer
 * (src/components/dashboard/editor-queue-tab.tsx) — this route never
 * writes anything itself; the editor must still review/edit the result
 * and explicitly call POST /api/articles/[id]/decision-letter to save or
 * publish it. Same reviewer-owns-the-content shape as
 * /api/reviews/[id]/completeness-check.
 *
 * Body: { decisionId }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

  const { id: articleId } = await params;
  const { decisionId } = (await req.json()) as { decisionId?: string };
  if (!decisionId) {
    return NextResponse.json({ error: "decisionId is required" }, { status: 400 });
  }

  const decision = await db.editorialDecision.findUnique({ where: { id: decisionId } });
  if (!decision || decision.articleId !== articleId) {
    return NextResponse.json({ error: "Decision not found for this article" }, { status: 404 });
  }

  const article = await db.article.findUnique({ where: { id: articleId }, select: { title: true } });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const result = await draftDecisionLetter({
    articleTitle: article.title,
    decisionAction: decision.decision,
    editorNote: decision.note || undefined,
  });

  return NextResponse.json(result);
}
