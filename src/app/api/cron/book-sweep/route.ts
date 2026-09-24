import { NextRequest, NextResponse } from "next/server";
import { sweepStuckBookProductionJobs } from "@/lib/book-production";

/**
 * GET /api/cron/book-sweep
 * Mirrors /api/cron/galley-sweep — recovers BookProductionJob rows
 * orphaned by a crashed/killed serverless invocation. Same fail-closed
 * CRON_SECRET gate. Not independently registered in vercel.json — folded
 * into the consolidated /api/cron/sweep-all dispatcher instead, so this
 * job still runs on schedule without adding a second per-sweep cron
 * entry. This route stays for manual/targeted admin retries.
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

  const result = await sweepStuckBookProductionJobs();
  return NextResponse.json(result);
}
