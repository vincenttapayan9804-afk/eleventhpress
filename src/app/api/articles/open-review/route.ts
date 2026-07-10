import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

/**
 * POST /api/articles/open-review
 * Toggles the openReview flag on an article. When true, all completed
 * reviews are made publicly visible alongside the published article.
 *
 * Body: { articleId, openReview: boolean }
 *
 * Editors + Admins only.
 *
 * Side effects:
 *   - When enabling openReview on a published article, all completed
 *     Review rows have madePublic=true set.
 *   - When disabling, madePublic is reset to false.
 *   - An audit log entry records the transition.
 *   - A notification is sent to each reviewer whose review is now public.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

  const { articleId, openReview } = (await req.json()) as {
    articleId: string;
    openReview: boolean;
  };

  const article = await db.article.findUnique({
    where: { id: articleId },
    include: { reviews: { include: { reviewer: true } } },
  });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  // Update article + reviews atomically
  const [, reviews] = await db.$transaction([
    db.article.update({
      where: { id: articleId },
      data: { openReview },
    }),
    db.review.updateMany({
      where: { articleId, status: "COMPLETED" },
      data: { madePublic: openReview },
    }),
  ]);

  // Audit log
  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: openReview ? "OPEN_REVIEW_ENABLED" : "OPEN_REVIEW_DISABLED",
      entityType: "ARTICLE",
      entityId: articleId,
      articleId,
      metadata: JSON.stringify({ reviewsAffected: reviews.count }),
    },
  });

  // Notify reviewers whose reviews are now public
  if (openReview) {
    const completedReviews = article.reviews.filter((r) => r.status === "COMPLETED");
    await db.notification.createMany({
      data: completedReviews.map((r) => ({
        userId: r.reviewerId,
        type: "INFO",
        title: "Your review is now public",
        message: `The editor has enabled Open Peer Review for "${article.title}". Your name, recommendation, and review comments are now visible on the public article page.`,
        articleId,
      })),
    });
  }

  return NextResponse.json({
    articleId,
    openReview,
    reviewsAffected: reviews.count,
  });
}

/**
 * GET /api/articles/open-review?articleId=…
 * Returns the public reviews for an article (only if openReview=true).
 * This endpoint is unauthenticated — it powers the public article page.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const articleId = searchParams.get("articleId");
  if (!articleId) return NextResponse.json({ error: "articleId required" }, { status: 400 });

  const article = await db.article.findUnique({
    where: { id: articleId },
    select: { openReview: true, title: true },
  });
  if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });

  if (!article.openReview) {
    return NextResponse.json({
      openReview: false,
      reviews: [],
      message: "Open peer review is not enabled for this article.",
    });
  }

  const reviews = await db.review.findMany({
    where: { articleId, status: "COMPLETED", madePublic: true },
    include: {
      reviewer: {
        select: {
          fullName: true,
          affiliation: true,
          orcid: true,
          country: true,
        },
      },
    },
    orderBy: { completedAt: "asc" },
  });

  return NextResponse.json({
    openReview: true,
    articleTitle: article.title,
    reviews: reviews.map((r) => ({
      id: r.id,
      completedAt: r.completedAt,
      overallScore: r.overallScore,
      recommendation: r.recommendation,
      confidence: r.confidence,
      commentsToAuthor: r.commentsToAuthor,
      reviewer: {
        fullName: r.reviewer.fullName,
        affiliation: r.reviewer.affiliation,
        orcid: r.reviewer.orcid,
        country: r.reviewer.country,
      },
    })),
  });
}
