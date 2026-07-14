import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { runGalleyJob } from "@/lib/galley-job";

/**
 * POST /api/admin/galley-jobs/[id]/retry
 * Manually re-runs a FAILED (or stuck) GalleyJob from the admin portal —
 * the same shared runner the cron sweep uses, just triggered on demand
 * instead of waiting for the next scheduled sweep. SUPER_ADMIN only.
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
  const job = await db.galleyJob.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  await runGalleyJob(id, session.userId);

  const updated = await db.galleyJob.findUnique({ where: { id } });
  return NextResponse.json({ job: updated });
}
