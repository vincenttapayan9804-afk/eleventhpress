import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

/**
 * GET /api/articles/assign-reviewer?articleId=...
 *   Returns eligible reviewers (REVIEWER-role users) with expertise matching
 *   the article's discipline.
 *
 * POST /api/articles/assign-reviewer
 *   { articleId, reviewerId, dueDate? }
 *   Invites a reviewer to an article.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const articleId = searchParams.get("articleId");
  if (!articleId) {
    return NextResponse.json({ error: "articleId required" }, { status: 400 });
  }
  const article = await db.article.findUnique({ where: { id: articleId } });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const reviewers = await db.user.findMany({
    where: { role: { in: ["REVIEWER", "ASSOCIATE_EDITOR", "EDITOR"] } },
    select: {
      id: true,
      fullName: true,
      affiliation: true,
      expertise: true,
      country: true,
      orcid: true,
    },
  });

  // Compute simple keyword-match score against discipline + keywords
  const disciplineLower = article.discipline.toLowerCase();
  const articleKeywords = article.keywords.toLowerCase().split(/[,\s]+/).filter(Boolean);

  const scored = reviewers
    .map((r) => {
      const expertise = (r.expertise || "").toLowerCase();
      let score = 0;
      if (expertise.includes(disciplineLower)) score += 3;
      for (const kw of articleKeywords) {
        if (expertise.includes(kw)) score += 2;
      }
      return { ...r, matchScore: score };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  return NextResponse.json({ reviewers: scored, articleDiscipline: article.discipline, articleKeywords });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

  const { articleId, reviewerId, dueDate } = (await req.json()) as {
    articleId: string;
    reviewerId: string;
    dueDate?: string;
  };

  const existing = await db.review.findFirst({
    where: { articleId, reviewerId },
  });
  if (existing) {
    return NextResponse.json({ error: "Reviewer already invited" }, { status: 409 });
  }

  const review = await db.review.create({
    data: {
      articleId,
      reviewerId,
      status: "INVITED",
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  // Notify reviewer
  const article = await db.article.findUnique({ where: { id: articleId } });
  await db.notification.create({
    data: {
      userId: reviewerId,
      type: "INFO",
      title: "Review Invitation",
      message: `You have been invited to review "${article?.title ?? ""}". The review model is ${article?.reviewModel ?? "DOUBLE_BLIND"} and the due date is ${review.dueDate?.toDateString()}.`,
      articleId,
    },
  });

  // Audit
  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "ASSIGN_REVIEWER",
      entityType: "REVIEW",
      entityId: review.id,
      articleId,
      metadata: JSON.stringify({ reviewerId }),
    },
  });

  // Move article to UNDER_REVIEW if currently SUBMITTED
  if (article && article.status === "SUBMITTED") {
    await db.article.update({
      where: { id: articleId },
      data: { status: "UNDER_REVIEW" },
    });
  }

  return NextResponse.json({ review });
}
