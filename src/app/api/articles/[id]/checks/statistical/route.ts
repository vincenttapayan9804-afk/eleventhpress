import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { checkStatisticalSanity } from "@/lib/manuscript-checks";

/**
 * GET /api/articles/[id]/checks/statistical
 * Returns the last-run statistical sanity check, if any (editor-only).
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
    select: { statisticalFlags: true, statisticalCheckedAt: true },
  });
  if (!article || !article.statisticalCheckedAt) {
    return NextResponse.json({ error: "No check run yet" }, { status: 404 });
  }
  return NextResponse.json({
    flags: JSON.parse(article.statisticalFlags || "[]"),
    checkedAt: article.statisticalCheckedAt,
  });
}

/**
 * POST /api/articles/[id]/checks/statistical
 * Runs (or re-runs) the statistical sanity check via
 * src/lib/manuscript-checks.ts (editor-only).
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

  const result = await checkStatisticalSanity(article);
  const checkedAt = new Date();
  await db.article.update({
    where: { id },
    data: { statisticalFlags: JSON.stringify(result.flags), statisticalCheckedAt: checkedAt },
  });

  return NextResponse.json({ flags: result.flags, mode: result.mode, model: result.model, checkedAt });
}
