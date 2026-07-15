import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { canViewUnpublishedArticle } from "@/lib/article-access";

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
  if (!isPublished) {
    const session = getSessionFromHeaders(req.headers);
    if (!canViewUnpublishedArticle(article.correspondingAuthorId, session)) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
  }

  // Increment view counter — published articles only, so an unauthorized
  // 404 above (or an author checking their own draft) never inflates it.
  if (isPublished) {
    db.article.update({ where: { id }, data: { views: { increment: 1 } } }).catch(() => {});
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

  return NextResponse.json({
    id: article.id,
    doi: article.doi,
    doiStatus: article.doiStatus,
    title: article.title,
    abstract: article.abstract,
    keywords: article.keywords,
    discipline: article.discipline,
    authors: article.authors,
    reviewModel: article.reviewModel,
    openReview: article.openReview,
    status: article.status,
    manuscriptKey: article.manuscriptKey,
    galleyPdfKey: article.galleyPdfKey,
    galleyHtmlKey: article.galleyHtmlKey,
    galleyJatsKey: article.galleyJatsKey,
    views: isPublished ? article.views + 1 : article.views,
    downloads: article.downloads,
    citations: article.citations,
    plagiarismScore: article.plagiarismScore,
    ithenticateScore: article.ithenticateScore,
    ithenticateReportUrl: article.ithenticateReportUrl,
    integrityStatus: article.integrityStatus,
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
