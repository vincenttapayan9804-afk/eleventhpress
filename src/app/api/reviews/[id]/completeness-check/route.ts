import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { checkReviewCompleteness } from "@/lib/review-helper";

/**
 * POST /api/reviews/[id]/completeness-check
 *
 * Advisory-only, non-blocking check of a reviewer's in-progress draft
 * (src/lib/review-helper.ts) — reads nothing but the submitted body, never
 * writes anything, and has no bearing on whether
 * POST /api/reviews/submit succeeds. Same reviewer-owns-this-review check
 * as the submit route.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: reviewId } = await params;

  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const review = await db.review.findUnique({ where: { id: reviewId } });
  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }
  if (review.reviewerId !== session.userId) {
    return NextResponse.json({ error: "Not your review" }, { status: 403 });
  }

  const body = (await req.json()) as { commentsToAuthor?: string; recommendation?: string };
  const result = await checkReviewCompleteness({
    commentsToAuthor: body.commentsToAuthor || "",
    recommendation: body.recommendation || "",
  });

  return NextResponse.json(result);
}
