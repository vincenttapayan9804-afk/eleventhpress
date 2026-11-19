import { NextRequest, NextResponse } from "next/server";
import { parseAuthors } from "@/lib/article";
import { buildKbart, bookRow, journalRow, kbartFilename } from "@/lib/kbart";
import { publisherIdentityForTenantId } from "@/lib/publisher-identity";
import { resolveTenantFromHeaders, tenantBaseUrl } from "@/lib/tenant";
import { withTenantRlsContext } from "@/lib/db-rls";

/**
 * GET /api/export/kbart
 * KBART Phase II title list (src/lib/kbart.ts): every journal with at least
 * one published issue, plus every published book, for library knowledge
 * bases. Public, like the other bulk metadata feeds (OAI-PMH, ONIX, OJS
 * export) — it only lists already-published titles. Scoped to the site's
 * tenant, under that tenant's publisher name.
 */
export async function GET(req: NextRequest) {
  const tenant = await resolveTenantFromHeaders(req.headers);
  const tenantId = tenant && !tenant.isPlatform ? tenant.id : null;
  const identity = await publisherIdentityForTenantId(tenantId);
  const base = await tenantBaseUrl(identity.tenantId);

  const [journals, books] = await withTenantRlsContext(tenant?.id ?? null, (tx) =>
    Promise.all([
      tx.journal.findMany({
        include: { issues: { where: { publishedAt: { not: null } }, select: { volume: true, issueNumber: true, year: true, publishedAt: true } } },
        orderBy: { name: "asc" },
      }),
      tx.book.findMany({
        where: { status: "PUBLISHED" },
        select: { id: true, title: true, isbn: true, authors: true, publishedAt: true, price: true },
        orderBy: { title: "asc" },
      }),
    ])
  );

  const rows = [
    ...journals
      .filter((j) => j.issues.length > 0)
      .map((j) =>
        journalRow({
          id: j.id,
          name: j.name,
          issn: j.issn,
          eissn: j.eissn,
          publisher: identity.whitelabel ? identity.publisher : j.publisher,
          issues: j.issues,
          titleUrl: `${base}/articles`,
        })
      ),
    ...books.map((b) =>
      bookRow({
        id: b.id,
        title: b.title,
        isbn: b.isbn,
        firstAuthor: parseAuthors(b.authors)[0]?.name ?? null,
        publishedAt: b.publishedAt,
        titleUrl: `${base}/book/${b.id}`,
        publisher: identity.publisher,
        free: !b.price,
      })
    ),
  ];

  return new NextResponse(buildKbart(rows), {
    headers: {
      "Content-Type": "text/tab-separated-values; charset=utf-8",
      "Content-Disposition": `inline; filename="${kbartFilename(identity.shortName)}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
