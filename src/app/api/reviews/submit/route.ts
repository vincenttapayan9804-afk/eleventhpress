import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

/**
 * POST /api/reviews/submit
 * Reviewer submits their completed review.
 *
 * Body: {
 *   reviewId, status: ACCEPTED|DECLINED|IN_PROGRESS|COMPLETED,
 *   overallScore?: 1-5,
 *   recommendation?: ACCEPT|MINOR_REVISIONS|MAJOR_REVISIONS|REJECT,
 *   confidence?: 1-5,
 *   commentsToAuthor?: string,
 *   commentsToEditor?: string,
 *   conflictOfInterest?: boolean,
 * }
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!["REVIEWER", "ASSOCIATE_EDITOR", "EDITOR", "SUPER_ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Reviewer role required" }, { status: 403 });
  }

  const body = (await req.json()) as {
    reviewId: string;
    status: "ACCEPTED" | "DECLINED" | "IN_PROGRESS" | "COMPLETED";
    overallScore?: number;
    recommendation?: string;
    confidence?: number;
    commentsToAuthor?: string;
    commentsToEditor?: string;
    conflictOfInterest?: boolean;
  };

  const review = await db.review.findUnique({
    where: { id: body.reviewId },
    include: { article: true },
  });
  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }
  if (review.reviewerId !== session.userId) {
    return NextResponse.json({ error: "Not your review" }, { status: 403 });
  }

  const updated = await db.review.update({
    where: { id: body.reviewId },
    data: {
      status: body.status,
      overallScore: body.overallScore ?? null,
      recommendation: body.recommendation ?? null,
      confidence: body.confidence ?? null,
      commentsToAuthor: body.commentsToAuthor ?? null,
      commentsToEditor: body.commentsToEditor ?? null,
      conflictOfInterest: body.conflictOfInterest ?? false,
      completedAt: body.status === "COMPLETED" ? new Date() : null,
    },
  });

  // Audit log
  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "SUBMIT_REVIEW",
      entityType: "REVIEW",
      entityId: body.reviewId,
      articleId: review.articleId,
      metadata: JSON.stringify({ status: body.status, recommendation: body.recommendation }),
    },
  });

  // Notify editors
  const editors = await db.user.findMany({
    where: { role: { in: ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"] } },
  });
  await db.notification.createMany({
    data: editors.map((e) => ({
      userId: e.id,
      type: body.status === "COMPLETED" ? "SUCCESS" : "INFO",
      title: body.status === "COMPLETED" ? "Review Completed" : `Review ${body.status}`,
      message: `A reviewer has ${body.status.toLowerCase()} review for "${review.article.title}"${
        body.recommendation ? ` — recommendation: ${body.recommendation}` : ""
      }.`,
      articleId: review.articleId,
    })),
  });

  return NextResponse.json({ review: updated });
}
