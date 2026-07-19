import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { presignGet, objectExists, getObject, putObject } from "@/lib/storage";
import { recordCounterEvent } from "@/lib/institutions";
import { getSessionFromHeaders } from "@/lib/auth";
import { stampPdf, stampEpub, type DownloadStamp } from "@/lib/watermark";
import { APP_BASE_URL } from "@/lib/site";

/**
 * GET /api/articles/[id]/galley?format=pdf|html|jats|epub
 *
 * Returns a download URL for the requested galley. Published articles are
 * open access (the site claims CC BY 4.0 everywhere — hero badge, footer,
 * About, FAQs, the APC explainer promising "indefinite open-access
 * hosting"), so this route no longer gates the PDF/HTML behind a reader
 * subscription: no authentication required at all for a PUBLISHED
 * article's galley. Two things forced this, not just the OA claim: (1) a
 * paywalled "open access" article is a real licensing inconsistency — CC
 * BY doesn't mean much if the platform itself won't show the content
 * without payment — and (2) Google Scholar's indexer hard-requires full
 * text be fetchable with no login wall, which an auth-gated URL can never
 * satisfy (see src/app/article/[id]/page.tsx's citation_pdf_url, which
 * depends on this route being genuinely public).
 *
 * The reader Subscription/Invoice models and checkout flow are untouched —
 * this only removes the gate on already-published, APC-funded content.
 * What a reader subscription should actually grant instead (bulk/batch
 * export, ahead-of-print early access, institutional analytics, etc.) is a
 * product decision this change doesn't make on its own.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") || "pdf").toLowerCase();
  if (!["pdf", "html", "jats", "epub"].includes(format)) {
    return NextResponse.json({ error: "format must be pdf, html, jats, or epub" }, { status: 400 });
  }

  const article = await db.article.findUnique({
    where: { id },
    include: { journal: true, issue: true },
  });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }
  if (article.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Article is not published" }, { status: 403 });
  }

  const galleyKey =
    format === "pdf" ? article.galleyPdfKey :
    format === "html" ? article.galleyHtmlKey :
    format === "jats" ? article.galleyJatsKey :
    article.galleyEpubKey;
  if (!galleyKey) {
    return NextResponse.json({ error: "Galley not yet generated" }, { status: 404 });
  }

  // Check that the galley actually exists in storage; if not, fall back to
  // a generated placeholder URL (the article-view will gracefully degrade).
  const exists = await objectExists(galleyKey);
  if (!exists) {
    return NextResponse.json(
      {
        error: "Galley not yet deposited in storage",
        key: galleyKey,
        message:
          "The galley file has not been uploaded to the storage layer yet. For seed-published articles the galley is generated on demand when an editor re-publishes the article.",
      },
      { status: 404 }
    );
  }

  const session = getSessionFromHeaders(req.headers);

  // PDF downloads are the metric the reader-facing "PDF downloads" stat
  // (Article.downloads) and the COUNTER5 Total_Item_Requests report are
  // both built on — until now this route never wrote to either, so
  // downloads never moved no matter how many readers actually downloaded
  // the PDF. Scoped to PDF only, matching the metric's own label.
  if (format === "pdf") {
    db.article.update({ where: { id }, data: { downloads: { increment: 1 } } }).catch(() => {});
    recordCounterEvent({
      articleId: id,
      metricType: "Total_Item_Requests",
      headers: req.headers,
      email: session?.email,
    });
  }

  const extension = format === "jats" ? "jats.xml" : format;
  const downloadFilename = `${article.doi?.replace(/[^a-z0-9]/gi, "-") || article.id}.${extension}`;

  // PDF/EPUB downloads get a real, per-download provenance stamp (see
  // src/lib/watermark.ts): a visible footer/banner plus embedded file
  // metadata naming who downloaded it and when, traceable via ArticleDown-
  // load below. This is NOT DRM — every article is CC BY 4.0, which
  // already permits redistribution and commercial reuse with attribution
  // — it only makes provenance traceable if a copy surfaces elsewhere.
  // HTML/JATS aren't stamped: JATS is a machine-readable archival/indexing
  // format, and HTML is served for in-browser reading, not carried away.
  if (format === "pdf" || format === "epub") {
    try {
      const original = await getObject(galleyKey);
      if (!original) throw new Error("galley bytes not found in storage");

      const download = await db.articleDownload.create({
        data: {
          articleId: article.id,
          format: format.toUpperCase(),
          userId: session?.userId ?? null,
          label: session?.fullName || "Anonymous reader",
        },
      });

      const stamp: DownloadStamp = {
        downloadId: download.id,
        label: download.label,
        timestampLabel: new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" }),
        doi: article.doi,
        verifyUrl: `${APP_BASE_URL}/verify/article/${article.id}`,
      };
      const stamped = format === "pdf" ? await stampPdf(original, stamp) : stampEpub(original, stamp);

      const stampedKey = `published-galleys/stamped/${article.id}-${download.id}.${format}`;
      const contentType = format === "pdf" ? "application/pdf" : "application/epub+zip";
      await putObject(stampedKey, stamped, contentType);

      const url = await presignGet(stampedKey, downloadFilename);
      return NextResponse.json({ url, key: stampedKey, format, expiresInSeconds: 600, downloadId: download.id });
    } catch (e: any) {
      // Stamping is best-effort — a stamping failure must never turn a
      // working, open-access download into a dead link. Falls back to the
      // original, unstamped galley.
      console.error(`[galley] provenance stamping failed for article ${id} (${format}):`, e);
    }
  }

  const url = await presignGet(galleyKey, downloadFilename);
  return NextResponse.json({ url, key: galleyKey, format, expiresInSeconds: 600 });
}
