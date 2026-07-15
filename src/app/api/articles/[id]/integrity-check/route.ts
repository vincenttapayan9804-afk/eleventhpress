import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { runIntegrityCheckJob } from "@/lib/ithenticate";

/**
 * POST /api/articles/[id]/integrity-check
 * Body: { articleId } (via URL param)
 *
 * Submits an article for the enterprise-tier iThenticate check. Always
 * editor-triggered (never auto-run on publish, unlike the free in-house
 * pgvector check) — each real submission has a genuine per-check vendor
 * cost. Dedupes against an already in-flight job the same way
 * /api/galley/generate does. Editors + Admins only.
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

  const inFlight = await db.integrityCheckJob.findFirst({
    where: { articleId, status: { in: ["QUEUED", "PROCESSING", "SUBMITTED"] } },
    orderBy: { createdAt: "desc" },
  });
  if (inFlight) {
    return NextResponse.json({ success: true, deduped: true, jobId: inFlight.id, status: inFlight.status });
  }

  const inputKey = article.manuscriptKey || article.anonymizedKey;
  if (!inputKey) {
    return NextResponse.json({ error: "No manuscript file available to check" }, { status: 400 });
  }

  const job = await db.integrityCheckJob.create({
    data: { articleId, inputKey, status: "QUEUED" },
  });

  await runIntegrityCheckJob(job.id, session.userId, { status: "QUEUED" });

  const finished = await db.integrityCheckJob.findUnique({ where: { id: job.id } });
  if (finished?.status === "COMPLETED" && finished.mode === "simulation") {
    await db.article.update({
      where: { id: articleId },
      data: { ithenticateCheckedAt: finished.completedAt },
    });
  }

  return NextResponse.json({ success: finished?.status !== "FAILED", job: finished });
}

/**
 * GET /api/articles/[id]/integrity-check
 * Returns the recent IntegrityCheckJob history for an article. Editors +
 * Admins only.
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
  const jobs = await db.integrityCheckJob.findMany({
    where: { articleId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return NextResponse.json({ jobs });
}
