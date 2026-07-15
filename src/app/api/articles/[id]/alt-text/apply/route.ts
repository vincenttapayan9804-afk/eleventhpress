import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { applyAltTextResults } from "@/lib/alt-text";

/**
 * POST /api/articles/[id]/alt-text/apply
 * Body: { jobId, results: [{ src, altText }] }
 *
 * Commits editor-reviewed alt text into the live galley HTML — the only
 * path that changes what's actually served. Suggestions from
 * runAltTextJob are never applied automatically; an editor reviews (and
 * may edit) each one first. Editors + Admins only.
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
  const { jobId, results } = (await req.json()) as { jobId: string; results: { src: string; altText: string }[] };
  if (!jobId || !Array.isArray(results)) {
    return NextResponse.json({ error: "jobId and results are required" }, { status: 400 });
  }

  const job = await db.altTextJob.findUnique({ where: { id: jobId } });
  if (!job || job.articleId !== articleId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  try {
    await applyAltTextResults(articleId, jobId, results);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "ALT_TEXT_APPLIED",
      entityType: "ARTICLE",
      entityId: articleId,
      articleId,
      metadata: JSON.stringify({ jobId, count: results.length }),
    },
  });

  return NextResponse.json({ success: true });
}
