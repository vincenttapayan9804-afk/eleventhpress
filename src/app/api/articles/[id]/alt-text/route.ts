import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { runAltTextJob } from "@/lib/alt-text";

/**
 * POST /api/articles/[id]/alt-text
 * Generates alt-text suggestions for every figure in an article's galley
 * HTML — dedupes against an in-flight job the same way
 * /api/galley/generate does. Editors + Admins only (authors don't control
 * the galley HTML directly).
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
  const article = await db.article.findUnique({ where: { id: articleId } });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }
  if (!article.galleyHtmlKey) {
    return NextResponse.json({ error: "Article has no galley HTML yet" }, { status: 400 });
  }

  const inFlight = await db.altTextJob.findFirst({
    where: { articleId, status: { in: ["QUEUED", "PROCESSING"] } },
    orderBy: { createdAt: "desc" },
  });
  if (inFlight) {
    return NextResponse.json({ success: true, deduped: true, jobId: inFlight.id, status: inFlight.status });
  }

  const job = await db.altTextJob.create({ data: { articleId, status: "QUEUED" } });
  await runAltTextJob(job.id, session.userId, { status: "QUEUED" });

  const finished = await db.altTextJob.findUnique({ where: { id: job.id } });
  return NextResponse.json({ success: finished?.status === "COMPLETED", job: finished });
}

/**
 * GET /api/articles/[id]/alt-text
 * Returns the most recent AltTextJob for an article, with its suggestions
 * parsed. Editors + Admins only.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

  const { id: articleId } = await params;
  const jobs = await db.altTextJob.findMany({
    where: { articleId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return NextResponse.json({
    jobs: jobs.map((j) => ({ ...j, results: j.results ? JSON.parse(j.results) : [] })),
  });
}
