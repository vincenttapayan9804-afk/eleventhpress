import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getObject } from "@/lib/storage";
import { extractTables, isChartable } from "@/lib/data-tables";

/**
 * GET /api/articles/[id]/data-tables
 *
 * Extracts every <table> from the article's real body content (same
 * article-body div GET /api/articles/[id]/body already isolates) for the
 * Supplemental Materials tab's "Interactive Data Visualization" section.
 * Public and unauthenticated, matching /body's open-access rationale —
 * this is the same already-public content, just structured differently.
 * An article with no tables (or none with numeric columns) returns an
 * empty array; the frontend must show that honestly, never a chart with
 * invented data.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const article = await db.article.findUnique({
    where: { id },
    select: { status: true, galleyHtmlKey: true },
  });
  if (!article || article.status !== "PUBLISHED" || !article.galleyHtmlKey) {
    return NextResponse.json({ tables: [] });
  }

  const buf = await getObject(article.galleyHtmlKey);
  if (!buf) {
    return NextResponse.json({ tables: [] });
  }

  const html = buf.toString("utf-8");
  const match = html.match(/<div class="article-body">([\s\S]*)<\/div>\s*<\/body>/);
  if (!match) {
    return NextResponse.json({ tables: [] });
  }

  const tables = extractTables(match[1]).map((t) => ({ ...t, chartable: isChartable(t) }));
  return NextResponse.json({ tables });
}
