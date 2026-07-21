import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { runTableExtractionJob } from "@/lib/table-extraction";

/**
 * POST /api/articles/[id]/table-extraction
 * Extracts structured data (columns/rows) out of every <table> in an
 * article's galley HTML — dedupes against an in-flight job the same way
 * /api/articles/[id]/table-accessibility does. Editors + Admins only.
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

  const inFlight = await db.tableExtractionJob.findFirst({
    where: { articleId, status: { in: ["QUEUED", "PROCESSING"] } },
    orderBy: { createdAt: "desc" },
  });
  if (inFlight) {
    return NextResponse.json({ success: true, deduped: true, jobId: inFlight.id, status: inFlight.status });
  }

  const job = await db.tableExtractionJob.create({ data: { articleId, status: "QUEUED" } });
  await runTableExtractionJob(job.id, session.userId, { status: "QUEUED" });

  const finished = await db.tableExtractionJob.findUnique({ where: { id: job.id } });
  return NextResponse.json({
    success: finished?.status === "COMPLETED",
    job: finished ? { ...finished, results: finished.results ? JSON.parse(finished.results) : [] } : null,
  });
}

/**
 * GET /api/articles/[id]/table-extraction
 * Returns the most recent TableExtractionJob for an article, with its
 * extracted data parsed. Editors + Admins only.
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
  const jobs = await db.tableExtractionJob.findMany({
    where: { articleId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return NextResponse.json({
    jobs: jobs.map((j) => ({ ...j, results: j.results ? JSON.parse(j.results) : [] })),
  });
}
