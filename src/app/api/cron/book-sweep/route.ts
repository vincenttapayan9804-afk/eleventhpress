import { NextRequest, NextResponse } from "next/server";
import { sweepStuckBookProductionJobs } from "@/lib/book-production";

/**
 * GET /api/cron/book-sweep
 * Mirrors /api/cron/galley-sweep — recovers BookProductionJob rows
 * orphaned by a crashed/killed serverless invocation. Same fail-closed
 * CRON_SECRET gate (see vercel.json), same bounded batch size.
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
