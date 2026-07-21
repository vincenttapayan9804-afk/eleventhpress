import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { applyTableAccessibilityResults } from "@/lib/table-accessibility";

/**
 * POST /api/articles/[id]/table-accessibility/apply
 * Body: { jobId, results: [{ index, caption }] }
 *
 * Commits editor-reviewed captions into the live galley HTML — the only
 * path that changes what's actually served. Suggestions from
 * runTableAccessibilityJob are never applied automatically; an editor
 * reviews (and may edit) each one first. Editors + Admins only.
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
  const { jobId, results } = (await req.json()) as { jobId: string; results: { index: number; caption: string }[] };
  if (!jobId || !Array.isArray(results)) {
    return NextResponse.json({ error: "jobId and results are required" }, { status: 400 });
  }

  const job = await db.tableAccessibilityJob.findUnique({ where: { id: jobId } });
  if (!job || job.articleId !== articleId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  try {
    await applyTableAccessibilityResults(articleId, jobId, results);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "TABLE_ACCESSIBILITY_APPLIED",
      entityType: "ARTICLE",
      entityId: articleId,
      articleId,
      metadata: JSON.stringify({ jobId, count: results.length }),
    },
  });

  return NextResponse.json({ success: true });
}
