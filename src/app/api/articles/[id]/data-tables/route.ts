import { NextRequest, NextResponse } from "next/server";
import { loadPublishedArticleTables } from "@/lib/article-data-tables-server";

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
 * invented data. Each table's branded PDF is …/data-tables/[n]/pdf.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tables = await loadPublishedArticleTables(id, req.headers);
  return NextResponse.json({ tables: tables ?? [] });
}
