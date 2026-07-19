import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeArticleContentHash, sha256 } from "@/lib/article-provenance-server";
import { getObject } from "@/lib/storage";

/**
 * GET /api/articles/[id]/verify — public, no auth. JSON counterpart to
 * /verify/article/[id], for programmatic checks. See that page for what
 * "verified" actually means here.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const article = await db.article.findUnique({ where: { id } });
  if (!article || article.status !== "PUBLISHED") {
    return NextResponse.json({ found: false }, { status: 404 });
  }
  if (!article.contentHash) {
    return NextResponse.json({ found: true, sealed: false, title: article.title });
  }

  const [pdfBytes, epubBytes] = await Promise.all([
    article.galleyPdfKey ? getObject(article.galleyPdfKey) : Promise.resolve(null),
    article.galleyEpubKey ? getObject(article.galleyEpubKey) : Promise.resolve(null),
  ]);
  const recomputedPdfHash = pdfBytes ? sha256(pdfBytes) : null;
  const recomputedEpubHash = epubBytes ? sha256(epubBytes) : null;
  const filesMatch =
    recomputedPdfHash === article.galleyPdfHash && recomputedEpubHash === article.galleyEpubHash;

  const recomputedContentHash = computeArticleContentHash({
    id: article.id,
    title: article.title,
    authors: article.authors,
    abstract: article.abstract,
    doi: article.doi,
    publishedAtIso: article.publishedAt ? article.publishedAt.toISOString() : null,
    contentType: article.contentType,
    discipline: article.discipline,
    insightCategory: article.insightCategory,
    keyTakeaways: article.keyTakeaways,
    galleyPdfHash: article.galleyPdfHash,
    galleyEpubHash: article.galleyEpubHash,
  });

  return NextResponse.json({
    found: true,
    sealed: true,
    valid: filesMatch && recomputedContentHash === article.contentHash,
    title: article.title,
    doi: article.doi,
    publishedAt: article.publishedAt,
    contentHash: article.contentHash,
    galleyPdfHash: article.galleyPdfHash,
    galleyEpubHash: article.galleyEpubHash,
    license: "CC BY 4.0",
  });
}
