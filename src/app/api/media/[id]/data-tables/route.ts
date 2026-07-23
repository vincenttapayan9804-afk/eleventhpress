import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractTables, isChartable } from "@/lib/data-tables";

/**
 * GET /api/media/[id]/data-tables
 * Mirrors /api/articles/[id]/data-tables for a MediaPost — bodyHtml is
 * stored directly, so this just runs extractTables() on it once published.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const post = await db.mediaPost.findUnique({
    where: { id },
    select: { status: true, bodyHtml: true },
  });
  if (!post || post.status !== "PUBLISHED") {
    return NextResponse.json({ tables: [] });
  }

  const tables = extractTables(post.bodyHtml).map((t) => ({ ...t, chartable: isChartable(t) }));
  return NextResponse.json({ tables });
}
