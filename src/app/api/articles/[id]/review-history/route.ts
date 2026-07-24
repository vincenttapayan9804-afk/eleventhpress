import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { getIndependentReviewsForArticle } from "@/lib/independent-reviews";
import { APP_BASE_URL } from "@/lib/site";

/**
 * POST /api/articles/[id]/review-history
 * Toggles Article.anonymizedReviewHistory. Editor/Associate Editor/
 * Super Admin only — mirrors POST /api/articles/open-review's shape
 * exactly, but there are no per-review side effects to apply here (unlike
 * openReview's madePublic backfill) since reviewer numbering is always
 * computed anonymously at read time, never stored per-review.
 *
 * Body: { anonymizedReviewHistory: boolean }
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
  const { anonymizedReviewHistory } = (await req.json()) as { anonymizedReviewHistory?: boolean };

  const article = await db.article.findUnique({ where: { id: articleId }, select: { id: true } });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const updated = await db.article.update({
    where: { id: articleId },
    data: { anonymizedReviewHistory: !!anonymizedReviewHistory },
  });

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: updated.anonymizedReviewHistory ? "REVIEW_HISTORY_ENABLED" : "REVIEW_HISTORY_DISABLED",
      entityType: "ARTICLE",
      entityId: articleId,
      articleId,
    },
  });

  return NextResponse.json({ articleId, anonymizedReviewHistory: updated.anonymizedReviewHistory });
}

/**
 * GET /api/articles/[id]/review-history
 *
 * Public, unauthenticated — powers the transparent Review History tab on
 * the public article page. Independent of (and can coexist with) the
 * existing signed Open Peer Review feature (openReview boolean,
 * src/app/api/articles/open-review/route.ts): that one shows completed
 * reviews with real reviewer identities; this one shows anonymized
 * reviewer numbering ("Reviewer 1"/"Reviewer 2", computed here at read
 * time from Review.createdAt order and never stored) plus the author's
 * responses and any decision letters an editor has explicitly published.
 *
 * Reviewer numbering is assigned across every Review row for the article
 * (any status), so a reviewer's number stays stable even if other
 * reviewers for the same round finish later — only completed reviews are
 * actually returned.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: articleId } = await params;

  const article = await db.article.findUnique({
    where: { id: articleId },
    select: {
      title: true,
      status: true,
      anonymizedReviewHistory: true,
      reviewReportDoi: true,
      reviewReportDepositedAt: true,
      doi: true,
    },
  });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  if (!article.anonymizedReviewHistory) {
    return NextResponse.json({
      enabled: false,
      message: "This article does not have a public Review History.",
    });
  }

  if (article.status !== "PUBLISHED") {
    return NextResponse.json({
      enabled: true,
      published: false,
      message: "Review History will be released once this article is published.",
    });
  }

  const [allReviews, authorResponses, decisions, communityReviews] = await Promise.all([
    db.review.findMany({
      where: { articleId },
      orderBy: { createdAt: "asc" },
    }),
    db.authorResponse.findMany({
      where: { articleId },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { fullName: true } } },
    }),
    db.editorialDecision.findMany({
      where: { articleId, letterPublishedAt: { not: null } },
      orderBy: { createdAt: "asc" },
      include: { editor: { select: { fullName: true } } },
    }),
    getIndependentReviewsForArticle(articleId, {
      canonicalUrl: `${APP_BASE_URL}/article/${articleId}`,
      doi: article.doi,
    }),
  ]);

  const reviews = allReviews
    .map((r, i) => ({ ...r, reviewerNumber: i + 1 }))
    .filter((r) => r.status === "COMPLETED")
    .map((r) => ({
      reviewerNumber: r.reviewerNumber,
      overallScore: r.overallScore,
      recommendation: r.recommendation,
      confidence: r.confidence,
      commentsToAuthor: r.commentsToAuthor,
      completedAt: r.completedAt,
    }));

  return NextResponse.json({
    enabled: true,
    published: true,
    articleTitle: article.title,
    reviews,
    authorResponses: authorResponses.map((a) => ({
      id: a.id,
      content: a.content,
      createdAt: a.createdAt,
      authorName: a.author.fullName,
    })),
    decisionLetters: decisions.map((d) => ({
      id: d.id,
      decision: d.decision,
      letterBody: d.letterBody,
      publishedAt: d.letterPublishedAt,
      editorName: d.editor.fullName,
    })),
    reviewReportDoi: article.reviewReportDoi,
    reviewReportDepositedAt: article.reviewReportDepositedAt,
    // Community and Independent Review sub-section: real, fetched reviews
    // from free external channels (Hypothes.is now; more in later phases).
    // Never gated behind anonymizedReviewHistory alone failing — if the
    // in-house side has nothing yet, this can still surface independent
    // signal on its own.
    communityReviews,
  });
}
