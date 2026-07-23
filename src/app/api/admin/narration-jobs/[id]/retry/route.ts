import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { runNarrationJob } from "@/lib/kokoro-tts";

/**
 * POST /api/admin/narration-jobs/[id]/retry
 * Mirrors /api/admin/magazine-jobs/[id]/retry — manually re-runs a FAILED
 * (or stuck) NarrationJob. SUPER_ADMIN only.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const job = await db.narrationJob.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  await db.narrationJob.update({ where: { id }, data: { status: "QUEUED", errorMessage: null } });
  await runNarrationJob(id, { status: "QUEUED" });

  const updated = await db.narrationJob.findUnique({ where: { id } });
  return NextResponse.json({ job: updated });
}
