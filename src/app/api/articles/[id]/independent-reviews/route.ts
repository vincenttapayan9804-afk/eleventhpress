import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import {
  addEditorCuratedReview,
  deleteEditorCuratedReview,
  listIndependentReviewsForAdmin,
  EDITOR_CURATED_CHANNELS,
  INDEPENDENT_REVIEW_CHANNELS,
  type IndependentReviewChannel,
} from "@/lib/independent-reviews";

function requireEditor(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }) };
  }
  if (!["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(session.role)) {
    return { error: NextResponse.json({ error: "Editor role required" }, { status: 403 }) };
  }
  return { session };
}

/**
 * GET /api/articles/[id]/independent-reviews
 *
 * Editor-only admin listing (automated + editor-entered rows, no sync
 * triggered) — powers the "Community and Independent Review — curated
 * links" manager in the editorial dashboard. The public Review History
 * endpoint (GET /api/articles/[id]/review-history) is the reader-facing
 * equivalent and does trigger a sync of the automated channels.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireEditor(req);
  if (auth.error) return auth.error;

  const { id: articleId } = await params;
  const article = await db.article.findUnique({ where: { id: articleId }, select: { id: true } });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const reviews = await listIndependentReviewsForAdmin(articleId);
  return NextResponse.json({
    reviews,
    curatedChannels: EDITOR_CURATED_CHANNELS.map((c) => ({
      value: c,
      label: INDEPENDENT_REVIEW_CHANNELS[c].label,
      description: INDEPENDENT_REVIEW_CHANNELS[c].description,
    })),
  });
}

/**
 * POST /api/articles/[id]/independent-reviews
 * Body: { channel, externalUrl, reviewerName?, excerpt?, recommendation? }
 *
 * Adds an editor-verified link from an Open Reputable Reviewer Platform
 * (PCI, Sciety, SciPost, OpenReview). The editor vouches for having
 * actually read the review at externalUrl; addEditorCuratedReview only
 * validates the channel and URL shape.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireEditor(req);
  if (auth.error) return auth.error;

  const { id: articleId } = await params;
  const article = await db.article.findUnique({ where: { id: articleId }, select: { id: true } });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const body = (await req.json()) as {
    channel?: IndependentReviewChannel;
    externalUrl?: string;
    reviewerName?: string;
    excerpt?: string;
    recommendation?: string;
  };

  if (!body.channel || !body.externalUrl) {
    return NextResponse.json({ error: "channel and externalUrl are required" }, { status: 400 });
  }

  try {
    const review = await addEditorCuratedReview(articleId, {
      channel: body.channel,
      externalUrl: body.externalUrl,
      reviewerName: body.reviewerName,
      excerpt: body.excerpt,
      recommendation: body.recommendation,
    });

    await db.auditLog.create({
      data: {
        userId: auth.session!.userId,
        action: "INDEPENDENT_REVIEW_CURATED",
        entityType: "ARTICLE",
        entityId: articleId,
        articleId,
        metadata: JSON.stringify({ channel: body.channel, externalUrl: body.externalUrl }),
      },
    });

    return NextResponse.json({ review });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

/**
 * DELETE /api/articles/[id]/independent-reviews
 * Body: { reviewId }
 * Removes an editor-entered curated link. Refuses to remove AUTOMATED rows.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireEditor(req);
  if (auth.error) return auth.error;

  const { id: articleId } = await params;
  const { reviewId } = (await req.json()) as { reviewId?: string };
  if (!reviewId) {
    return NextResponse.json({ error: "reviewId is required" }, { status: 400 });
  }

  try {
    await deleteEditorCuratedReview(articleId, reviewId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
