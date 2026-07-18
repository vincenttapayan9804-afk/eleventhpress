import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { depositReviewReportToZenodo } from "@/lib/zenodo";

/**
 * POST /api/articles/[id]/review-report-doi
 *
 * Manual trigger/retry for minting the review report's Zenodo DOI
 * (src/lib/zenodo.ts depositReviewReportToZenodo) — mirrors the existing
 * "Deposit to Zenodo" retry precedent for the article's own DOI
 * (depositPublishedArticleToZenodo). Needed because the automatic deposit
 * only fires from the publish workflow when anonymizedReviewHistory is
 * already true at that moment; an editor who enables transparency after
 * publication (or whose first attempt failed) uses this instead.
 *
 * Editor/Associate Editor/Super Admin only.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

  const { id: articleId } = await params;
  const result = await depositReviewReportToZenodo(articleId);

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "REVIEW_REPORT_DOI_DEPOSIT",
      entityType: "ARTICLE",
      entityId: articleId,
      articleId,
      metadata: JSON.stringify({ ok: result.ok, mode: result.mode, doi: result.doi }),
    },
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
