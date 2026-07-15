import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { runIntegrityCheckJob } from "@/lib/ithenticate";

/**
 * POST /api/admin/integrity-jobs/[id]/retry
 * Manually re-runs a FAILED (or stuck QUEUED/PROCESSING) IntegrityCheckJob
 * — mirrors /api/admin/galley-jobs/[id]/retry. Does not retry a job
 * already SUBMITTED to the real vendor (see sweepStuckIntegrityChecks's
 * docstring in src/lib/ithenticate.ts for why). SUPER_ADMIN only.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  const { id } = await params;
  const job = await db.integrityCheckJob.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (job.status === "SUBMITTED") {
    return NextResponse.json({ error: "Job already submitted to iThenticate — awaiting its webhook, not retryable" }, { status: 409 });
  }

  await runIntegrityCheckJob(id, session.userId);

  const updated = await db.integrityCheckJob.findUnique({ where: { id } });
  return NextResponse.json({ job: updated });
}
