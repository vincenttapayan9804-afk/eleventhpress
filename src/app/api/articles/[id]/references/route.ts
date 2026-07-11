import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/articles/[id]/references
 * Public — the article's bibliography with any OpenAlex validation results.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const references = await db.reference.findMany({
    where: { articleId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ references });
}
