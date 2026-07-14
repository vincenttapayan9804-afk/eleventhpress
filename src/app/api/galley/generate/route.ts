import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { runGalleyJob } from "@/lib/galley-job";

/**
 * POST /api/galley/generate
 * Body: { articleId }
 *
 * Generates HTML, PDF, and JATS galleys for an article using the in-process
 * galley service (src/lib/galley.ts). If a QUEUED/PROCESSING job already
 * exists for this article (e.g. a double-click, or a still-running previous
 * request), returns that job instead of starting a redundant, racy second
 * one — the actual generation work always runs through the shared
 * runGalleyJob() runner (src/lib/galley-job.ts), which is also what the
 * cron sweep and admin manual-retry use to recover a job that crashed
 * mid-run instead of it silently vanishing.
 *
 * Editors + Admins only.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

  const { articleId } = (await req.json()) as { articleId: string };

  const article = await db.article.findUnique({ where: { id: articleId } });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const inFlight = await db.galleyJob.findFirst({
    where: { articleId, status: { in: ["QUEUED", "PROCESSING"] } },
    orderBy: { createdAt: "desc" },
  });
  if (inFlight) {
    return NextResponse.json({
      success: true,
      deduped: true,
      jobId: inFlight.id,
      status: inFlight.status,
    });
  }

  const job = await db.galleyJob.create({
    data: {
      articleId,
      inputKey: article.manuscriptKey || `synthesised/${article.id}.md`,
      status: "QUEUED",
    },
  });

  await runGalleyJob(job.id, session.userId, { status: "QUEUED" });

  const finished = await db.galleyJob.findUnique({ where: { id: job.id } });
  if (!finished || finished.status !== "COMPLETED") {
    return NextResponse.json({
      success: false,
      error: finished?.errorMessage || "Galley generation failed",
      jobId: job.id,
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    jobId: job.id,
    htmlKey: finished.htmlKey,
    pdfKey: finished.pdfKey,
    jatsKey: finished.jatsKey,
    log: finished.workerLog ? JSON.parse(finished.workerLog) : [],
  });
}

/**
 * GET /api/galley/generate?articleId=…
 * Returns the recent GalleyJob history for an article. Editors + Admins
 * only (previously unauthenticated — nothing in the app actually called
 * this without a session, so gating it closes an unused info-disclosure
 * path with zero behavioral risk).
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const articleId = searchParams.get("articleId");
  if (!articleId) return NextResponse.json({ error: "articleId required" }, { status: 400 });

  const jobs = await db.galleyJob.findMany({
    where: { articleId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return NextResponse.json({ jobs });
}
