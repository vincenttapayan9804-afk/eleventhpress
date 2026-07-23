import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

/**
 * GET /api/admin/magazine-jobs
 * Mirrors /api/admin/book-jobs — lists the most recent
 * MagazineIssueProductionJob rows for operational visibility. SUPER_ADMIN only.
 */
export async function GET(req: NextRequest) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const jobs = await db.magazineIssueProductionJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const issueIds = Array.from(new Set(jobs.map((j) => j.issueId)));
  const issues = await db.magazineIssue.findMany({
    where: { id: { in: issueIds } },
    select: { id: true, title: true, volume: true, issueNumber: true },
  });
  const labelById = new Map(issues.map((i) => [i.id, i.title || `Vol. ${i.volume}, No. ${i.issueNumber}`]));

  return NextResponse.json({
    jobs: jobs.map((j) => ({ ...j, issueLabel: labelById.get(j.issueId) || null })),
  });
}
