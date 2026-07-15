import { NextRequest, NextResponse } from "next/server";
import { sweepStuckIntegrityChecks } from "@/lib/ithenticate";

/**
 * GET /api/cron/ithenticate-sweep
 *
 * Safety net for integrity-check submissions that never made it to the
 * vendor (the invocation that owned them crashed before submitting) —
 * mirrors /api/cron/galley-sweep exactly, including the fail-closed
 * CRON_SECRET gate. Deliberately NOT registered in vercel.json yet,
 * matching how /api/cron/book-sweep is also left unregistered pending
 * confirmation of Hobby-tier cron-job count headroom; manual admin retry
 * (POST /api/admin/integrity-jobs/[id]/retry) covers recovery until then.
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

  const result = await sweepStuckIntegrityChecks();
  return NextResponse.json(result);
}
