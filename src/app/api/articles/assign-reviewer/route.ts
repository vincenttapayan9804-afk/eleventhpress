import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { getSessionFromHeaders } from "@/lib/auth";
import { isSameEditorialTenant } from "@/lib/tenant-auth";
import { generateEmbedding } from "@/lib/embeddings";
import { cosineSimilarity } from "@/lib/vector-math";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { withRlsContext, withTenantRlsContext } from "@/lib/db-rls";
import { declaredConflict, editorCoiFor, latestArticleForm, missingEditorForms, opposedReviewerEmails, requiredFormsBody } from "@/lib/forms/server";

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
 *   { articleId, reviewerId, dueDate?, confirmOpposed? }
 *   Invites a reviewer to an article. The first invitation sends the
 *   manuscript to review, so it needs the same editor forms as Send to
 *   review (EP-F-09, EP-F-10, EP-F-20). Inviting someone the authors asked
 *   not to be invited (EP-F-15) needs `confirmOpposed`.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const articleId = searchParams.get("articleId");
  if (!articleId) {
    return NextResponse.json({ error: "articleId required" }, { status: 400 });
  }
  const tenant = await resolveTenantFromHeaders(req.headers);
  const article = await withTenantRlsContext(tenant?.id ?? null, (tx) =>
    tx.article.findUnique({ where: { id: articleId }, include: { journal: true } })
  );
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
      email: true,
      fullName: true,
      affiliation: true,
      expertise: true,
      country: true,
      orcid: true,
    },
  });
  const opposed = new Set(session ? await opposedReviewerEmails(article.id) : []);

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
        const { email, ...rest } = r;
        // Flag (never reveal) people the authors asked not to be invited (EP-F-15).
        return { ...rest, matchScore, semanticScore, keywordBonus, opposedByAuthors: opposed.has(email.toLowerCase()) };
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
  if (!["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN", "TENANT_ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

  const { articleId, reviewerId, dueDate, confirmOpposed } = (await req.json()) as {
    articleId: string;
    reviewerId: string;
    dueDate?: string;
    confirmOpposed?: boolean;
  };

  const targetArticle = await withRlsContext(session, (tx) =>
    tx.article.findUnique({ where: { id: articleId }, include: { journal: true } })
  );
  if (!targetArticle) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }
  if (!isSameEditorialTenant(session, targetArticle.journal?.tenantId)) {
    return NextResponse.json({ error: "Forbidden — not an editor of this article's tenant" }, { status: 403 });
  }

  // The first invitation sends the manuscript to review: editor forms first.
  if (targetArticle.status === "SUBMITTED") {
    if (declaredConflict(await editorCoiFor(session.userId, articleId))) {
      return NextResponse.json({ error: "You declared a competing interest on this manuscript (EP-F-09) and are recused from it." }, { status: 403 });
    }
    const missing = await missingEditorForms(session.userId, articleId, "SEND_TO_REVIEW");
    if (missing.length) return NextResponse.json(requiredFormsBody(missing), { status: 428 });
    const screening = await latestArticleForm(articleId, "form-desk-screening");
    if (screening && screening.outcome !== "review") {
      return NextResponse.json({ error: "The Initial Editorial Screening Checklist (EP-F-20) does not clear this manuscript for peer review." }, { status: 409 });
    }
  }
  if (!confirmOpposed) {
    const reviewer = await db.user.findUnique({ where: { id: reviewerId }, select: { email: true } });
    const opposed = await opposedReviewerEmails(articleId);
    if (reviewer && opposed.includes(reviewer.email.toLowerCase())) {
      return NextResponse.json(
        { error: "The authors asked that this person not be invited (EP-F-15). Read their reason in the Forms tab before going ahead.", opposed: true },
        { status: 409 }
      );
    }
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
  await notify({
    userId: reviewerId,
    type: "INFO",
    category: "REVIEWS",
    link: "/dashboard/reviewer-queue",
    title: "Review Invitation",
    message: `You have been invited to review "${targetArticle.title}". The review model is ${targetArticle.reviewModel ?? "DOUBLE_BLIND"} and the due date is ${review.dueDate?.toDateString()}.`,
    articleId,
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
