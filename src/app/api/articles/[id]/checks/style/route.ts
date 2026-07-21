import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { checkHouseStyle } from "@/lib/manuscript-checks";

/**
 * GET /api/articles/[id]/checks/style
 * Returns the last-run house-style consistency check, if any (editor-only).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromHeaders(req.headers);
  if (!session || !["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }
  const { id } = await params;
  const article = await db.article.findUnique({
    where: { id },
    select: { styleFlags: true, styleCheckedAt: true },
  });
  if (!article || !article.styleCheckedAt) {
    return NextResponse.json({ error: "No check run yet" }, { status: 404 });
  }
  return NextResponse.json({
    flags: JSON.parse(article.styleFlags || "[]"),
    checkedAt: article.styleCheckedAt,
  });
}

/**
 * POST /api/articles/[id]/checks/style
 * Runs (or re-runs) the house-style consistency check via
 * src/lib/manuscript-checks.ts (editor-only). Works for an article in any
 * status — including PUBLISHED — same as the statistical/similarity
 * checks this mirrors, so an editor can apply it to already-published
 * articles from this same panel without a separate batch tool.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromHeaders(req.headers);
  if (!session || !["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }
  const { id } = await params;
  const article = await db.article.findUnique({
    where: { id },
    select: { title: true, abstract: true },
  });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const result = await checkHouseStyle(article);
  const checkedAt = new Date();
  await db.article.update({
    where: { id },
    data: { styleFlags: JSON.stringify(result.flags), styleCheckedAt: checkedAt },
  });

  return NextResponse.json({ flags: result.flags, mode: result.mode, model: result.model, checkedAt });
}
