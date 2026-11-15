import { NextRequest, NextResponse } from "next/server";
import { ensureStudyGuide, sweepStudyGuides } from "@/lib/study-guide/server";

/**
 * GET /api/cron/study-guides — background builder for the Research
 * Study Guides (src/lib/study-guide/server.ts).
 *
 *   ?article=<id>  build that article's LLM-written guide (called after
 *                  publish, after a download of an instant guide, and by
 *                  the daily sweep — each request gets its own time limit)
 *   (no params)    sweep: give every published article a guide and queue
 *                  upgrades (also run daily from /api/cron/sweep-all)
 *
 * Same fail-closed CRON_SECRET gate as every other cron route.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 403 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const article = req.nextUrl.searchParams.get("article");
  try {
    if (article) return NextResponse.json({ ok: true, article, mode: await ensureStudyGuide(article, { full: true }) });
    return NextResponse.json({ ok: true, ...(await sweepStudyGuides()) });
  } catch (e) {
    console.error("[study-guide] cron failed", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
