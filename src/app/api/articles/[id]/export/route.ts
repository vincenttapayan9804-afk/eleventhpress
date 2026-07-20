import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { canViewUnpublishedArticle } from "@/lib/article-access";
import { buildBibTeX, buildRis, buildWikidataQuickStatements } from "@/lib/citation-export";

/**
 * GET /api/articles/[id]/export?format=ris|bibtex|wikidata
 * Real, downloadable reference-manager files (Zotero/Mendeley/EndNote all
 * import RIS or BibTeX) — replaces the article page's previous
 * copy-to-clipboard-only citation flow. `wikidata` returns a QuickStatements
 * batch (src/lib/citation-export.ts) an editor pastes into
 * quickstatements.toolforge.org to create the article's Wikidata item.
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
  if (format !== "ris" && format !== "bibtex" && format !== "wikidata") {
    return NextResponse.json({ error: "format must be 'ris', 'bibtex', or 'wikidata'" }, { status: 400 });
  }

  const article = await db.article.findUnique({
    where: { id },
    include: { journal: true, issue: true },
  });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  if (article.status !== "PUBLISHED") {
    const session = getSessionFromHeaders(req.headers);
    if (!canViewUnpublishedArticle(article.correspondingAuthorId, session)) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
  }

  const exportable = {
    title: article.title,
    authors: article.authors,
    publishedAt: article.publishedAt,
    doi: article.doi,
    journalName: article.journal?.name,
    journalIssn: article.journal?.issn,
    volume: article.issue?.volume,
    issueNumber: article.issue?.issueNumber,
    year: article.issue?.year,
  };

  const filename = article.doi?.replace(/[^a-z0-9]/gi, "-") || article.id;
  const body =
    format === "ris"
      ? buildRis(exportable)
      : format === "bibtex"
        ? buildBibTeX(exportable)
        : buildWikidataQuickStatements(exportable);
  const contentType =
    format === "ris"
      ? "application/x-research-info-systems"
      : format === "bibtex"
        ? "application/x-bibtex"
        : "text/plain";
  const extension = format === "ris" ? "ris" : format === "bibtex" ? "bib" : "qs.txt";

  return new NextResponse(body, {
    headers: {
      "Content-Type": `${contentType}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${filename}.${extension}"`,
      "Cache-Control": "no-store",
    },
  });
}
