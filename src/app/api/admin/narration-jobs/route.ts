import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

/**
 * GET /api/admin/narration-jobs
 * Mirrors /api/admin/magazine-jobs — lists the most recent NarrationJob
 * rows for operational visibility. SUPER_ADMIN only.
 */
export async function GET(req: NextRequest) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const jobs = await db.narrationJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ jobs });
}
