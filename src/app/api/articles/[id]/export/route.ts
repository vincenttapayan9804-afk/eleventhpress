import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { canViewUnpublishedArticle } from "@/lib/article-access";
import { buildBibTeX, buildRis, buildWikidataQuickStatements, buildMarcXml, citeKey } from "@/lib/citation-export";
import { resolveTenantFromHeaders, tenantBaseUrl } from "@/lib/tenant";
import { withTenantRlsContext } from "@/lib/db-rls";
import { publisherIdentityForJournal } from "@/lib/publisher-identity";

/**
 * GET /api/articles/[id]/export?format=ris|bibtex|wikidata|marc
 * Real, downloadable reference-manager files (Zotero/Mendeley/EndNote all
 * import RIS or BibTeX) — replaces the article page's previous
 * copy-to-clipboard-only citation flow. `wikidata` returns a QuickStatements
 * batch (src/lib/citation-export.ts) an editor pastes into
 * quickstatements.toolforge.org to create the article's Wikidata item.
 * `marc` returns a MARCXML record for direct import into a library's
 * integrated library system (Alma/Primo, Koha, Evergreen).
 * Same access rule as /api/articles/[id]: PUBLISHED is public, anything
 * still in the pipeline requires the corresponding author or editorial
 * staff.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const format = req.nextUrl.searchParams.get("format");
  if (format !== "ris" && format !== "bibtex" && format !== "wikidata" && format !== "marc") {
    return NextResponse.json({ error: "format must be 'ris', 'bibtex', 'wikidata', or 'marc'" }, { status: 400 });
  }

  const tenant = await resolveTenantFromHeaders(req.headers);
  const article = await withTenantRlsContext(tenant?.id ?? null, (tx) =>
    tx.article.findUnique({
      where: { id },
      include: { journal: true, issue: true },
    })
  );
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  if (article.status !== "PUBLISHED") {
    const session = getSessionFromHeaders(req.headers);
    if (!canViewUnpublishedArticle(article.correspondingAuthorId, session)) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
  }

  // A tenant's article is cited under its own publisher, journal and site.
  const [identity, baseUrl] = await Promise.all([
    publisherIdentityForJournal(article.journal ?? null),
    tenantBaseUrl(article.journal?.tenantId ?? null),
  ]);
  const exportable = {
    id: article.id,
    title: article.title,
    authors: article.authors,
    publishedAt: article.publishedAt,
    doi: article.doi,
    journalName: article.journal?.name || identity.journalName,
    journalIssn: article.journal?.issn || identity.issn,
    volume: article.issue?.volume,
    issueNumber: article.issue?.issueNumber,
    year: article.issue?.year,
    abstract: article.abstract,
    keywords: article.keywords,
    discipline: article.discipline,
    publisher: identity.publisher,
    articleUrl: `${baseUrl}/article/${article.id}`,
  };

  // "tan2026microplastic.ris" — the cite key reference managers use.
  const filename = citeKey(exportable) || article.id;
  const body =
    format === "ris"
      ? buildRis(exportable)
      : format === "bibtex"
        ? buildBibTeX(exportable)
        : format === "marc"
          ? buildMarcXml(exportable)
          : buildWikidataQuickStatements(exportable);
  const contentType =
    format === "ris"
      ? "application/x-research-info-systems"
      : format === "bibtex"
        ? "application/x-bibtex"
        : format === "marc"
          ? "application/marcxml+xml"
          : "text/plain";
  const extension = format === "ris" ? "ris" : format === "bibtex" ? "bib" : format === "marc" ? "marc.xml" : "qs.txt";

  return new NextResponse(body, {
    headers: {
      "Content-Type": `${contentType}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${filename}.${extension}"`,
      "Cache-Control": "no-store",
    },
  });
}
