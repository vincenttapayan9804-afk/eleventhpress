import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkReferencesForRetractions } from "@/lib/retraction-watch";

/**
 * GET /api/articles/[id]/reference-integrity
 * Cross-references this article's already-resolved citations (Reference.doi)
 * against the local Retraction Watch mirror. Public and unauthenticated,
 * same open-access rationale as GET /api/articles/[id]/data-tables.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const article = await db.article.findUnique({ where: { id }, select: { status: true } });
  if (!article || article.status !== "PUBLISHED") {
    return NextResponse.json({ everSynced: false, syncedAt: null, flagged: [] });
  }

  const result = await checkReferencesForRetractions(id);
  return NextResponse.json(result);
}
