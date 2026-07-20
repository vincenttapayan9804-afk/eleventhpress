import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { presignGet } from "@/lib/storage";
import { PREPRINT_ELIGIBLE_STATUSES } from "@/lib/article";

/**
 * GET /api/preprints/[id]/download
 *
 * Presigns the raw manuscript file for a public preprint — the same
 * presignGet() every galley download route already uses
 * (src/app/api/articles/[id]/galley/route.ts), scoped to
 * article.manuscriptKey rather than a production galley. Only ever
 * returns a URL while the article is a live, eligible-status preprint.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await db.article.findUnique({ where: { id } });
  if (!article || !article.isPreprint || !PREPRINT_ELIGIBLE_STATUSES.includes(article.status as any)) {
    return NextResponse.json({ error: "Preprint not found" }, { status: 404 });
  }
  if (!article.manuscriptKey) {
    return NextResponse.json({ error: "No manuscript file on record for this preprint" }, { status: 404 });
  }

  const url = await presignGet(article.manuscriptKey, `${article.id}-preprint`);
  return NextResponse.json({ url });
}
