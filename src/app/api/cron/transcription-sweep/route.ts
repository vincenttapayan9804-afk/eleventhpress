import { NextRequest, NextResponse } from "next/server";
import { sweepStuckTranscriptionJobs } from "@/lib/transcription";

/**
 * GET /api/cron/transcription-sweep
 * Mirrors /api/cron/galley-sweep exactly, including the fail-closed
 * CRON_SECRET gate. Deliberately NOT registered in vercel.json yet,
 * matching /api/cron/book-sweep, /api/cron/ithenticate-sweep, and
 * /api/cron/alt-text-sweep, pending confirmation of Hobby-tier
 * cron-job count headroom — see docs/university-os-research-lab-tier1.md.
 * Until then, sweepStuckTranscriptionJobs() is reachable manually (an
 * admin curling this route with the right CRON_SECRET) or once headroom
 * allows, by adding this path to vercel.json's crons array — the sweep
 * logic itself has been ready since the transcription tool shipped, this
 * closes the "route to call it" gap.
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

  const result = await sweepStuckTranscriptionJobs();
  return NextResponse.json(result);
}
