import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildOnixMessage } from "@/lib/onix";
import { APP_BASE_URL } from "@/lib/site";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { withTenantRlsContext } from "@/lib/db-rls";

/**
 * GET /api/books/[id]/onix
 * Returns the ONIX 3.0 <ONIXMessage> for a single published book — one
 * <Product> per distributable format it actually has (EPUB, print-ready
 * PDF). Used both as a direct download and as the dashboard's preview
 * pane (src/components/dashboard/indexing-tab.tsx), same pattern as
 * /api/crossref/xml/[id].
 *
 * Whitelabel Phase 8 — scoped by the resolved tenant, same as every other
 * public single-record read: an id from a different tenant 404s.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tenant = await resolveTenantFromHeaders(req.headers);
  const tenantId = tenant?.id ?? null;
  const book = await withTenantRlsContext(tenantId, (tx) => tx.book.findFirst({ where: { id, tenantId } }));
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
  if (book.status !== "PUBLISHED") {
    return NextResponse.json(
      { error: "ONIX export is only available for published books." },
      { status: 400 }
    );
  }

  const xml = buildOnixMessage([
    {
      id: book.id,
      title: book.title,
      subtitle: book.subtitle,
      authors: book.authors,
      description: book.description,
      category: book.category,
      isbn: book.isbn,
      price: book.price,
      publishedAt: book.publishedAt,
      epubKey: book.epubKey,
      pdfKey: book.pdfKey,
      canonicalUrl: `${APP_BASE_URL}/book/${book.id}`,
    },
  ]);

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
