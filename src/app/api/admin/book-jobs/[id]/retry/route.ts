import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { runBookProductionJob } from "@/lib/book-production";

/**
 * POST /api/admin/book-jobs/[id]/retry
 * Mirrors /api/admin/galley-jobs/[id]/retry — manually re-runs a FAILED (or
 * stuck) BookProductionJob. SUPER_ADMIN only.
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
  const job = await db.bookProductionJob.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  await runBookProductionJob(id, session.userId);

  const updated = await db.bookProductionJob.findUnique({ where: { id } });
  return NextResponse.json({ job: updated });
}
