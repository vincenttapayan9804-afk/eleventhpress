import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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

  const [allReviews, authorResponses, decisions] = await Promise.all([
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
  });
}
