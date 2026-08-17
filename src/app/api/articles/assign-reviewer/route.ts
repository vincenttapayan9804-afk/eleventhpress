import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { isSameEditorialTenant } from "@/lib/tenant-auth";
import { generateEmbedding } from "@/lib/embeddings";
import { cosineSimilarity } from "@/lib/vector-math";

/**
 * GET /api/articles/assign-reviewer?articleId=...
 *   Returns eligible reviewers (REVIEWER-role users) ranked by semantic
 *   similarity between the article's title/abstract/discipline and each
 *   reviewer's expertise text (src/lib/embeddings.ts's hashed n-gram
 *   embedding — same "real, corpus-relative, not a hosted semantic model"
 *   approach used for search — see docs/standards.md), with a keyword
 *   substring bonus so an exact discipline/keyword match still counts even
 *   when the expertise text is too short for the hash embedding to be
 *   informative on its own.
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
  const article = await db.article.findUnique({ where: { id: articleId }, include: { journal: true } });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }
  const session = getSessionFromHeaders(req.headers);
  if (session && !isSameEditorialTenant(session, article.journal?.tenantId)) {
    return NextResponse.json({ error: "Forbidden — not an editor of this article's tenant" }, { status: 403 });
  }

  // Whitelabel Phase 7 — never suggest a reviewer from a different tenant
  // than the article's own. article.journal.tenantId is null for
  // pre-Phase-1 journals, in which case every reviewer is eligible
  // (nothing to scope against), matching isSameEditorialTenant's fail-open
  // posture above.
  const reviewers = await db.user.findMany({
    where: {
      role: { in: ["REVIEWER", "ASSOCIATE_EDITOR", "EDITOR"] },
      ...(article.journal?.tenantId ? { tenantId: article.journal.tenantId } : {}),
    },
    select: {
      id: true,
      fullName: true,
      affiliation: true,
      expertise: true,
      country: true,
      orcid: true,
    },
  });

  const disciplineLower = article.discipline.toLowerCase();
  const articleKeywords = article.keywords.toLowerCase().split(/[,\s]+/).filter(Boolean);
  const articleEmbedding = await generateEmbedding(
    `${article.title}. ${article.abstract} ${article.keywords} ${article.discipline}`
  );

  const scored = (
    await Promise.all(
      reviewers.map(async (r) => {
        const expertiseRaw = r.expertise || "";
        const expertise = expertiseRaw.toLowerCase();

        let keywordBonus = 0;
        if (expertise.includes(disciplineLower)) keywordBonus += 10;
        for (const kw of articleKeywords) {
          if (expertise.includes(kw)) keywordBonus += 5;
        }

        let semanticScore = 0;
        if (expertiseRaw.trim()) {
          const reviewerEmbedding = await generateEmbedding(expertiseRaw);
          semanticScore = Math.round(cosineSimilarity(articleEmbedding, reviewerEmbedding) * 100);
        }

        const matchScore = Math.min(100, semanticScore + keywordBonus);
        return { ...r, matchScore, semanticScore, keywordBonus };
      })
    )
  ).sort((a, b) => b.matchScore - a.matchScore);

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

  const targetArticle = await db.article.findUnique({ where: { id: articleId }, include: { journal: true } });
  if (!targetArticle) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }
  if (!isSameEditorialTenant(session, targetArticle.journal?.tenantId)) {
    return NextResponse.json({ error: "Forbidden — not an editor of this article's tenant" }, { status: 403 });
  }

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
  await db.notification.create({
    data: {
      userId: reviewerId,
      type: "INFO",
      title: "Review Invitation",
      message: `You have been invited to review "${targetArticle.title}". The review model is ${targetArticle.reviewModel ?? "DOUBLE_BLIND"} and the due date is ${review.dueDate?.toDateString()}.`,
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
  if (targetArticle.status === "SUBMITTED") {
    await db.article.update({
      where: { id: articleId },
      data: { status: "UNDER_REVIEW" },
    });
  }

  return NextResponse.json({ review });
}
