import { NextRequest, NextResponse } from "next/server";
import { sweepStuckGalleyJobs } from "@/lib/galley-job";

/**
 * GET /api/cron/galley-sweep
 *
 * Safety net for the galley generation pipeline: POST /api/galley/generate
 * runs a job synchronously today, so a job only ever gets orphaned (stuck
 * in QUEUED or PROCESSING forever, with no automatic recovery) if the
 * serverless invocation that owned it crashed or was killed mid-run. This
 * endpoint, triggered on a schedule by Vercel Cron (see vercel.json),
 * finds and retries those — bounded batch size so one sweep can't run
 * unbounded.
 *
 * Fails closed: requires CRON_SECRET to be set and to match the request's
 * Authorization header (the scheme Vercel Cron uses when the env var is
 * present — https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).
 * Until CRON_SECRET is configured in the project's environment variables,
 * this route always returns 403 and never touches the database.
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

  const result = await sweepStuckGalleyJobs();
  return NextResponse.json(result);
}
