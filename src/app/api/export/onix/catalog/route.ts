import { publisherIdentityForTenantId } from "@/lib/publisher-identity";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildOnixMessage } from "@/lib/onix";
import { resolveTenantFromHeaders, tenantBaseUrl } from "@/lib/tenant";
import { withTenantRlsContext } from "@/lib/db-rls";

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
export async function GET(req: NextRequest) {
  const tenant = await resolveTenantFromHeaders(req.headers);
  const books = await withTenantRlsContext(tenant?.id ?? null, (tx) =>
    tx.book.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
    })
  );

  // A whitelabel tenant's catalogue is sent and published under its own name.
  const identity = await publisherIdentityForTenantId(tenant && !tenant.isPlatform ? tenant.id : null);
  const base = await tenantBaseUrl(identity.tenantId);
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
      canonicalUrl: `${base}/book/${b.id}`,
      publisherName: identity.whitelabel ? identity.publisher : null,
    })),
    identity.whitelabel ? { name: identity.publisher, email: identity.email } : undefined
  );

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${onixFileSlug(identity)}-onix-catalog.xml"`,
      "Cache-Control": "no-store",
    },
  });
}

function onixFileSlug(identity: { whitelabel: boolean; shortName: string }): string {
  if (!identity.whitelabel) return "eleventh-press";
  return identity.shortName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "catalog";
}
