import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { canViewUnpublishedArticle } from "@/lib/article-access";
import { deleteArticleCascade } from "@/lib/article-delete";
import { recordCounterEvent } from "@/lib/institutions";
import { resolveAuthorAvatars } from "@/lib/author-accounts";
import { parseAuthors } from "@/lib/article";

/**
 * GET /api/articles/[id]
 * Returns full article detail. No session was ever required here, which
 * previously meant any article — draft, in review, rejected — was
 * fetchable by anyone who had (or guessed) its id, not just PUBLISHED
 * ones; a real confidentiality gap for work still under blind review.
 * Non-PUBLISHED articles now require the corresponding author's own
 * session or editorial staff (src/lib/article-access.ts) — the only two
 * ways the frontend ever legitimately reaches this endpoint for a
 * non-published article (the public article page only ever links to
 * published work; "My Submissions" always requests the viewer's own).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const article = await db.article.findUnique({
    where: { id },
    include: { issue: true, journal: true, author: true },
  });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const isPublished = article.status === "PUBLISHED";
  const session = getSessionFromHeaders(req.headers);
  if (!isPublished) {
    if (!canViewUnpublishedArticle(article.correspondingAuthorId, session)) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
  }

  // Increment view counter — published articles only, so an unauthorized
  // 404 above (or an author checking their own draft) never inflates it.
  // Also records a real COUNTER5 CounterEvent (src/lib/institutions.ts),
  // attributed to the requester's institution when IP/domain-matched, so
  // COUNTER5/SUSHI reports reflect genuine per-institution usage instead
  // of being synthesized from this same views counter.
  if (isPublished) {
    db.article.update({ where: { id }, data: { views: { increment: 1 } } }).catch(() => {});
    recordCounterEvent({
      articleId: id,
      metricType: "Total_Item_Investigations",
      headers: req.headers,
      email: session?.email,
    });
  }

  // Cache-Control is only ever set on the PUBLISHED branch: that response
  // is identical for every visitor and safe to share at the CDN edge. The
  // non-published branch is per-viewer (an author's own draft) and must
  // never be cached publicly, so it deliberately gets no cache header at
  // all (Vercel's default for API routes is uncached). A short s-maxage
  // trades a little view-count precision (a burst of reads within the
  // window only increments once) for real protection against a viral
  // article's traffic spike hitting the database on every request.
  const headers: Record<string, string> = isPublished
    ? { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=120" }
    : {};

  // One avatarUrl (or null) per author entry, in the same order as
  // parseAuthors(article.authors) — real registered-account photos where a
  // co-author's ORCID/email matches a User, initials fallback otherwise.
  const authorAvatars = await resolveAuthorAvatars(parseAuthors(article.authors));

  return NextResponse.json({
    id: article.id,
    doi: article.doi,
    doiStatus: article.doiStatus,
    title: article.title,
    abstract: article.abstract,
    keywords: article.keywords,
    discipline: article.discipline,
    contentType: article.contentType,
    insightCategory: article.insightCategory,
    keyTakeaways: article.keyTakeaways,
    authors: article.authors,
    authorAvatars,
    reviewModel: article.reviewModel,
    openReview: article.openReview,
    status: article.status,
    manuscriptKey: article.manuscriptKey,
    galleyPdfKey: article.galleyPdfKey,
    galleyHtmlKey: article.galleyHtmlKey,
    galleyJatsKey: article.galleyJatsKey,
    galleyEpubKey: article.galleyEpubKey,
    views: isPublished ? article.views + 1 : article.views,
    downloads: article.downloads,
    citations: article.citations,
    plagiarismScore: article.plagiarismScore,
    ithenticateScore: article.ithenticateScore,
    ithenticateReportUrl: article.ithenticateReportUrl,
    integrityStatus: article.integrityStatus,
    abstractTranslations: article.abstractTranslations,
    glossary: article.glossary,
    glossaryMeta: article.glossaryMeta,
    funders: article.funders,
    laySummary: article.laySummary,
    submittedAt: article.submittedAt,
    acceptedAt: article.acceptedAt,
    publishedAt: article.publishedAt,
    crossrefBatchId: article.crossrefBatchId,
    crossrefDepositedAt: article.crossrefDepositedAt,
    volume: article.issue?.volume ?? null,
    issueNumber: article.issue?.issueNumber ?? null,
    year: article.issue?.year ?? null,
    issueTitle: article.issue?.title ?? null,
    journalName: article.journal?.name,
    journalIssn: article.journal?.issn,
    publisher: article.journal?.publisher,
  }, { headers });
}

/**
 * DELETE /api/articles/[id]
 * Permanently removes an Article and every row that references it
 * (src/lib/article-delete.ts) — this destroys real data (reviews,
 * decisions, corrections, DOI history) with no undo, unlike the editorial
 * workflow transitions (REJECT/WITHDRAWN) which just change `status` and
 * keep the record.
 *
 * SUPER_ADMIN can delete any article, any status. The corresponding
 * author can delete their own article only while it's pre-publication
 * (anything other than PUBLISHED) — once an article has a live DOI and is
 * indexed externally (OAI-PMH, Crossref, Google Scholar), deleting it
 * would leave a dead link across the internet; the correct way to remove
 * published work from circulation is a Correction/Retraction notice
 * (src/app/api/articles/[id]/corrections), not deletion.
 *
 * Writes an AuditLog entry after the row is gone (articleId left null
 * since the FK target no longer exists; entityId — a plain string, not a
 * relation — still records which id was deleted).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const article = await db.article.findUnique({ where: { id } });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const isAdmin = session.role === "SUPER_ADMIN";
  const isOwner = session.userId === article.correspondingAuthorId;

  if (!isAdmin) {
    if (!isOwner) {
      return NextResponse.json({ error: "Not authorized to delete this article" }, { status: 403 });
    }
    if (article.status === "PUBLISHED") {
      return NextResponse.json(
        { error: "Published articles can't be deleted by the author — request a correction or retraction instead." },
        { status: 403 }
      );
    }
  }

  await deleteArticleCascade(article, { deleteFiles: true });

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "ARTICLE_DELETED",
      entityType: "ARTICLE",
      entityId: article.id,
      metadata: JSON.stringify({
        title: article.title,
        doi: article.doi,
        status: article.status,
        deletedBy: isAdmin ? "SUPER_ADMIN" : "AUTHOR",
      }),
    },
  });

  return NextResponse.json({ ok: true });
}
