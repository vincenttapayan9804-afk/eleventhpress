import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { notifyMany } from "@/lib/notify";
import { editorsForReview } from "@/lib/review-editors";

/**
 * POST /api/reviews/[id]/respond — the invited reviewer accepts or declines.
 * Body: { action: "ACCEPT" | "DECLINE", reason?: string, suggestedReviewer?: string }
 * The handling editor is told either way; a decline carries the reason
 * and any suggested alternative reviewer.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: string; reason?: string; suggestedReviewer?: string };
  if (body.action !== "ACCEPT" && body.action !== "DECLINE") {
    return NextResponse.json({ error: "action must be ACCEPT or DECLINE" }, { status: 400 });
  }

  const review = await db.review.findUnique({
    where: { id },
    include: { article: { select: { id: true, title: true } }, reviewer: { select: { fullName: true } } },
  });
  if (!review || review.reviewerId !== session.userId) {
    return NextResponse.json({ error: "Review invitation not found" }, { status: 404 });
  }
  if (review.status !== "INVITED") {
    return NextResponse.json({ error: "You've already responded to this invitation" }, { status: 409 });
  }

  const reason = (body.reason || "").trim().slice(0, 1000);
  const suggestion = (body.suggestedReviewer || "").trim().slice(0, 300);
  const accepted = body.action === "ACCEPT";
  const updated = await db.review.update({
    where: { id },
    data: {
      status: accepted ? "ACCEPTED" : "DECLINED",
      respondedAt: new Date(),
      declineReason: accepted ? null : [reason, suggestion && `Suggested reviewer: ${suggestion}`].filter(Boolean).join("\n") || null,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: accepted ? "REVIEW_ACCEPTED" : "REVIEW_DECLINED",
      entityType: "REVIEW",
      entityId: id,
      articleId: review.articleId,
      metadata: JSON.stringify(accepted ? {} : { reason, suggestion }),
    },
  });

  const editors = await editorsForReview(id);
  await notifyMany(
    editors.map((userId) => ({
      userId,
      type: accepted ? ("SUCCESS" as const) : ("WARNING" as const),
      category: "EDITORIAL" as const,
      link: "/dashboard/editor-queue",
      title: accepted ? "Review invitation accepted" : "Review invitation declined",
      message: accepted
        ? `${review.reviewer.fullName} accepted the invitation to review "${review.article.title}". Due ${updated.dueDate ? updated.dueDate.toDateString() : "—"}.`
        : `${review.reviewer.fullName} declined to review "${review.article.title}".${reason ? ` Reason: ${reason}` : ""}${suggestion ? ` Suggested reviewer: ${suggestion}` : ""} You may want to invite someone else.`,
      articleId: review.articleId,
    }))
  );

  return NextResponse.json({ review: { id: updated.id, status: updated.status, dueDate: updated.dueDate } });
}
