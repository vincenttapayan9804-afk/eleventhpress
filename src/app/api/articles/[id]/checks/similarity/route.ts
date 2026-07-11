import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { checkSimilarity } from "@/lib/manuscript-checks";

/**
 * GET /api/articles/[id]/checks/similarity
 * Returns the last-run in-corpus similarity report (editor-only).
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
    select: { plagiarismScore: true, similarityReport: true, similarityCheckedAt: true },
  });
  if (!article || !article.similarityCheckedAt) {
    return NextResponse.json({ error: "No check run yet" }, { status: 404 });
  }
  return NextResponse.json({
    score: article.plagiarismScore,
    matches: JSON.parse(article.similarityReport || "[]"),
    checkedAt: article.similarityCheckedAt,
  });
}

/**
 * POST /api/articles/[id]/checks/similarity
 * Re-runs the in-corpus similarity check (editor-only) — useful once the
 * corpus has grown since the article's own submission-time check, or once
 * the full manuscript text is available in a later revision.
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

  const result = await checkSimilarity(`${article.title}. ${article.abstract}`, id);
  const checkedAt = new Date();
  await db.article.update({
    where: { id },
    data: {
      plagiarismScore: result.score,
      similarityReport: JSON.stringify(result.matches),
      similarityCheckedAt: checkedAt,
    },
  });

  return NextResponse.json({ score: result.score, matches: result.matches, checkedAt });
}
