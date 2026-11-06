import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { APP_BASE_URL } from "@/lib/site";
import { loadPublishedArticleTables } from "@/lib/article-data-tables-server";
import { buildDataTablePdf, dataTablePdfFileName } from "@/lib/data-table-pdf";

/**
 * GET /api/articles/[id]/data-tables/[index]/pdf — public, no auth, like
 * the table JSON it mirrors. `index` is 1-based ("Table 1"). Returns a
 * journal-branded PDF of that one table with the article's full
 * publication record, descriptive statistics and a citation
 * (src/lib/data-table-pdf.ts). Add ?inline=1 to view instead of download.
 */
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  const { id, index } = await params;
  const n = Number(index);
  if (!Number.isInteger(n) || n < 1) {
    return NextResponse.json({ error: "Table number must be a positive integer" }, { status: 400 });
  }

  const tables = await loadPublishedArticleTables(id, req.headers);
  if (tables === null) {
    return NextResponse.json({ error: "No published article with this ID" }, { status: 404 });
  }
  const table = tables[n - 1];
  if (!table) {
    return NextResponse.json({ error: `This article has no Table ${n}` }, { status: 404 });
  }

  // Tenant visibility was already enforced by loadPublishedArticleTables.
  const article = await db.article.findUnique({
    where: { id },
    select: {
      id: true, title: true, authors: true, doi: true, keywords: true, discipline: true, contentType: true,
      publishedAt: true, submittedAt: true, acceptedAt: true,
      journal: { select: { name: true, issn: true, publisher: true } },
      issue: { select: { volume: true, issueNumber: true, year: true } },
    },
  });
  if (!article) {
    return NextResponse.json({ error: "No published article with this ID" }, { status: 404 });
  }

  const pdf = await buildDataTablePdf({
    article: {
      id: article.id,
      title: article.title.replace(/\s+/g, " ").trim(),
      authors: article.authors,
      doi: article.doi,
      keywords: article.keywords,
      discipline: article.discipline,
      contentType: article.contentType,
      publishedAt: article.publishedAt,
      submittedAt: article.submittedAt,
      acceptedAt: article.acceptedAt,
      journalName: article.journal.name,
      journalIssn: article.journal.issn,
      publisher: article.journal.publisher,
      volume: article.issue?.volume ?? null,
      issueNumber: article.issue?.issueNumber ?? null,
      year: article.issue?.year ?? null,
      articleUrl: `${APP_BASE_URL}/article/${article.id}`,
    },
    table,
    tableNumber: n,
    tableCount: tables.length,
  });

  const inline = req.nextUrl.searchParams.get("inline") === "1";
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${dataTablePdfFileName({ title: article.title.trim() }, n)}"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
