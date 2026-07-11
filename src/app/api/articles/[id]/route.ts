import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/articles/[id]
 * Returns full article detail.
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
  // Increment view counter
  db.article.update({ where: { id }, data: { views: { increment: 1 } } }).catch(() => {});

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
    views: article.views + 1,
    downloads: article.downloads,
    citations: article.citations,
    plagiarismScore: article.plagiarismScore,
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
  });
}
