import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { runAltTextJob } from "@/lib/alt-text";

/**
 * POST /api/admin/alt-text-jobs/[id]/retry
 * Manually re-runs a FAILED (or stuck) AltTextJob — mirrors
 * /api/admin/galley-jobs/[id]/retry. SUPER_ADMIN only.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { session } = auth;

  const { id } = await params;
  const job = await db.altTextJob.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  await runAltTextJob(id, session.userId);

  const updated = await db.altTextJob.findUnique({ where: { id } });
  return NextResponse.json({ job: updated });
}
