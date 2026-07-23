import { NextRequest, NextResponse } from "next/server";
import { sweepStuckMagazineIssueProductionJobs } from "@/lib/magazine-production";

/**
 * GET /api/cron/magazine-sweep
 * Mirrors /api/cron/book-sweep — recovers MagazineIssueProductionJob rows
 * orphaned by a crashed/killed serverless invocation. Same fail-closed
 * CRON_SECRET gate, same bounded batch size.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 403 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const result = await sweepStuckMagazineIssueProductionJobs();
  return NextResponse.json(result);
}
