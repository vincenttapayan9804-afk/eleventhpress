import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractTables, isChartable } from "@/lib/data-tables";

/**
 * GET /api/magazine-pieces/[id]/data-tables
 * Mirrors /api/articles/[id]/data-tables for a MagazinePiece — bodyHtml is
 * stored directly (no separate galley extraction step), so this just runs
 * extractTables() on it once the piece's issue is published.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const piece = await db.magazinePiece.findUnique({
    where: { id },
    select: { bodyHtml: true, issue: { select: { status: true } } },
  });
  if (!piece || piece.issue.status !== "PUBLISHED") {
    return NextResponse.json({ tables: [] });
  }

  const tables = extractTables(piece.bodyHtml).map((t) => ({ ...t, chartable: isChartable(t) }));
  return NextResponse.json({ tables });
}
