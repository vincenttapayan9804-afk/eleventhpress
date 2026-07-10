import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/articles/[id]/reviews
 *
 * Returns the public peer-review history for an article.
 *
 * - If the article has `openReview === true` AND is PUBLISHED, all
 *   completed reviews with `madePublic === true` are returned including
 *   the reviewer's name, affiliation, ORCID, recommendation, scores,
 *   comments-to-author, and completion date.
 * - Otherwise a 403 is returned with a clear message explaining that
 *   the article is not under an open peer-review model.
 *
 * Reviewer commentsToEditor are NEVER exposed publicly — those are
 * confidential to the editorial office regardless of review model.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const article = await db.article.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      openReview: true,
      reviewModel: true,
      publishedAt: true,
    },
  });

  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  if (!article.openReview) {
    return NextResponse.json(
      {
        openReview: false,
        message:
          "This article was not published under the open peer-review model. Reviews are not publicly available.",
        reviewModel: article.reviewModel,
      },
      { status: 403 }
    );
  }

  if (article.status !== "PUBLISHED") {
    return NextResponse.json(
      {
        openReview: true,
        published: false,
        message:
          "This article is published under the open peer-review model, but reviews will be released when the article is published.",
      },
      { status: 403 }
    );
  }

  const reviews = await db.review.findMany({
    where: { articleId: id, madePublic: true, status: "COMPLETED" },
    include: {
      reviewer: {
        select: {
          id: true,
          fullName: true,
          affiliation: true,
          orcid: true,
          expertise: true,
          country: true,
        },
      },
    },
    orderBy: { completedAt: "asc" },
  });

  return NextResponse.json({
    openReview: true,
    published: true,
    article: {
      id: article.id,
      title: article.title,
      publishedAt: article.publishedAt,
      reviewModel: article.reviewModel,
    },
    reviews: reviews.map((r) => ({
      id: r.id,
      completedAt: r.completedAt,
      recommendation: r.recommendation,
      overallScore: r.overallScore,
      confidence: r.confidence,
      conflictOfInterest: r.conflictOfInterest,
      commentsToAuthor: r.commentsToAuthor,
      // NOTE: commentsToEditor is intentionally omitted — editorial-only.
      reviewer: {
        fullName: r.reviewer.fullName,
        affiliation: r.reviewer.affiliation,
        orcid: r.reviewer.orcid,
        expertise: r.reviewer.expertise,
        country: r.reviewer.country,
      },
    })),
  });
}
