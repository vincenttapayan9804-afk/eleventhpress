import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { runGalleyJob } from "@/lib/galley-job";

/**
 * POST /api/admin/galley-jobs/[id]/retry
 * Manually re-runs a FAILED (or stuck) GalleyJob from the admin portal —
 * the same shared runner the cron sweep uses, just triggered on demand
 * instead of waiting for the next scheduled sweep. SUPER_ADMIN only.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { session } = auth;

  const { id } = await params;
  const job = await db.galleyJob.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  await runGalleyJob(id, session.userId);

  const updated = await db.galleyJob.findUnique({ where: { id } });
  return NextResponse.json({ job: updated });
}
