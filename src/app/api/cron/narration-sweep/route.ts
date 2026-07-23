import { NextRequest, NextResponse } from "next/server";
import { sweepStuckNarrationJobs } from "@/lib/kokoro-tts";

/**
 * GET /api/cron/narration-sweep
 * Mirrors /api/cron/magazine-sweep — recovers NarrationJob rows orphaned by
 * a crashed/killed serverless invocation. Same fail-closed CRON_SECRET
 * gate, same bounded batch size. Not registered in vercel.json — same
 * Hobby-tier cron-count reason as magazine-sweep/transcription; trigger
 * manually or once a paid Vercel cron slot is available.
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

  const result = await sweepStuckNarrationJobs();
  return NextResponse.json(result);
}
