import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildOnixMessage } from "@/lib/onix";
import { APP_BASE_URL } from "@/lib/site";

/**
 * GET /api/export/onix/catalog
 * Bulk ONIX 3.0 export: every PUBLISHED book, one <Product> per
 * distributable format (EPUB, print-ready PDF), wrapped in a single
 * <ONIXMessage> — the file shape IngramSpark/Draft2Digital and most
 * library wholesaler ONIX ingestion tools expect for a full backlist feed.
 * Public and unauthenticated, same convention as the other bulk metadata
 * feeds this platform already publishes (OAI-PMH, sitemap, OJS export) —
 * it only ever exposes already-public, already-published book metadata.
 */
export async function GET() {
  const books = await db.book.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
  });

  const xml = buildOnixMessage(
    books.map((b) => ({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle,
      authors: b.authors,
      description: b.description,
      category: b.category,
      isbn: b.isbn,
      price: b.price,
      publishedAt: b.publishedAt,
      epubKey: b.epubKey,
      pdfKey: b.pdfKey,
      canonicalUrl: `${APP_BASE_URL}/book/${b.id}`,
    }))
  );

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": 'attachment; filename="eleventh-press-onix-catalog.xml"',
      "Cache-Control": "no-store",
    },
  });
}
