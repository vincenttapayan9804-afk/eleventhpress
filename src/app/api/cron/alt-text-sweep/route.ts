import { NextRequest, NextResponse } from "next/server";
import { sweepStuckAltTextJobs } from "@/lib/alt-text";

/**
 * GET /api/cron/alt-text-sweep
 * Mirrors /api/cron/galley-sweep exactly, including the fail-closed
 * CRON_SECRET gate. Deliberately NOT registered in vercel.json yet,
 * matching /api/cron/book-sweep and /api/cron/ithenticate-sweep, pending
 * confirmation of Hobby-tier cron-job count headroom.
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

  const result = await sweepStuckAltTextJobs();
  return NextResponse.json(result);
}
