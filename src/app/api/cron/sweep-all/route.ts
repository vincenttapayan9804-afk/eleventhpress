import { NextRequest, NextResponse } from "next/server";
import { sweepStuckAltTextJobs } from "@/lib/alt-text";
import { sweepStuckMalwareScans } from "@/lib/malware-scan-job";
import { sweepStuckBookProductionJobs } from "@/lib/book-production";
import { sweepStuckMagazineIssueProductionJobs } from "@/lib/magazine-production";
import { sweepStuckIntegrityChecks } from "@/lib/ithenticate";
import { sweepStuckNarrationJobs } from "@/lib/kokoro-tts";
import { sweepStuckTranscriptionJobs } from "@/lib/transcription";

/**
 * GET /api/cron/sweep-all
 *
 * Dispatcher for the seven sweep jobs (alt-text, malware-scan, book,
 * magazine, ithenticate, narration, transcription) that each have their
 * own /api/cron/*-sweep route and sweep function, ready since the
 * feature they recover shipped, but were never added to vercel.json's
 * crons array — every one of those routes documents the same reason:
 * "pending confirmation of Hobby-tier cron-job count headroom" (Vercel's
 * free tier caps the number of registered cron jobs per project).
 *
 * Rather than resolve that by guessing at the account's plan, this route
 * calls all seven sweep functions directly and is itself the only new
 * vercel.json entry — one additional registered cron, not seven,
 * regardless of tier. The individual *-sweep routes are untouched and
 * still independently reachable for manual/targeted admin retries.
 *
 * Each sweep runs even if another throws (Promise.allSettled) — one
 * broken job type recovering shouldn't block recovery of the other six.
 * Same fail-closed CRON_SECRET gate as every other cron route.
 */
const SWEEPS = [
  { name: "altText", run: sweepStuckAltTextJobs },
  { name: "malwareScan", run: sweepStuckMalwareScans },
  { name: "book", run: sweepStuckBookProductionJobs },
  { name: "magazine", run: sweepStuckMagazineIssueProductionJobs },
  { name: "ithenticate", run: sweepStuckIntegrityChecks },
  { name: "narration", run: sweepStuckNarrationJobs },
  { name: "transcription", run: sweepStuckTranscriptionJobs },
] as const;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 403 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const settled = await Promise.allSettled(SWEEPS.map((s) => s.run()));
  const results = Object.fromEntries(
    settled.map((outcome, i) =>
      outcome.status === "fulfilled"
        ? [SWEEPS[i].name, outcome.value]
        : [SWEEPS[i].name, { error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason) }]
    )
  );
  const failed = settled.filter((o) => o.status === "rejected").length;

  return NextResponse.json({ ok: failed === 0, failedSweeps: failed, results });
}
