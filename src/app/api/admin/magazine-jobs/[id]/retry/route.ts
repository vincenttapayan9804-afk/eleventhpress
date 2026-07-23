import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { runMagazineIssueProductionJob } from "@/lib/magazine-production";

/**
 * POST /api/admin/magazine-jobs/[id]/retry
 * Mirrors /api/admin/book-jobs/[id]/retry — manually re-runs a FAILED (or
 * stuck) MagazineIssueProductionJob. SUPER_ADMIN only.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { session } = auth;

  const { id } = await params;
  const job = await db.magazineIssueProductionJob.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  await runMagazineIssueProductionJob(id, session.userId);

  const updated = await db.magazineIssueProductionJob.findUnique({ where: { id } });
  return NextResponse.json({ job: updated });
}
