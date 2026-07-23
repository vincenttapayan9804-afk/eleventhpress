import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { presignGet } from "@/lib/storage";
import { runNarrationJob, type NarrationContentType } from "@/lib/kokoro-tts";

const CONTENT_TYPES: NarrationContentType[] = ["ARTICLE", "MAGAZINE_PIECE", "MEDIA_POST"];
const EDITORIAL_ROLES = ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"];

/**
 * POST /api/narration
 * Creates (or re-triggers) a NarrationJob for a published Article,
 * MagazinePiece, or MediaPost and runs it synchronously — same pattern as
 * the magazine issue workflow's SEND_TO_PRODUCTION action. Editorial roles
 * only: narration should be a deliberate editorial action, not automatic
 * on every publish, since it takes real (if free) compute time per request.
 */
export async function POST(req: NextRequest) {
  const auth = requireRole(req.headers, EDITORIAL_ROLES);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { session } = auth;

  const body = (await req.json().catch(() => ({}))) as { contentType?: string; contentId?: string; voice?: string };
  const { contentType, contentId, voice } = body;
  if (!contentType || !contentId || !CONTENT_TYPES.includes(contentType as NarrationContentType)) {
    return NextResponse.json({ error: "contentType must be one of ARTICLE, MAGAZINE_PIECE, MEDIA_POST" }, { status: 400 });
  }

  const job = await db.narrationJob.upsert({
    where: { contentType_contentId: { contentType, contentId } },
    create: { contentType, contentId, createdById: session.userId, voice: voice || undefined, status: "QUEUED" },
    update: { status: "QUEUED", voice: voice || undefined, errorMessage: null, audioKey: null },
  });

  await runNarrationJob(job.id, { status: "QUEUED" });

  const finished = await db.narrationJob.findUnique({ where: { id: job.id } });
  return NextResponse.json({ success: finished?.status === "COMPLETED", job: finished });
}

/**
 * GET /api/narration?contentType=ARTICLE&contentId=...
 * Public — returns the narration status for a content item, plus a
 * fetchable audio URL once COMPLETED, so any public reader view can show
 * a "Listen" player once one exists.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const contentType = searchParams.get("contentType");
  const contentId = searchParams.get("contentId");
  if (!contentType || !contentId || !CONTENT_TYPES.includes(contentType as NarrationContentType)) {
    return NextResponse.json({ error: "contentType must be one of ARTICLE, MAGAZINE_PIECE, MEDIA_POST" }, { status: 400 });
  }

  const job = await db.narrationJob.findUnique({ where: { contentType_contentId: { contentType, contentId } } });
  if (!job) {
    return NextResponse.json({ status: null });
  }

  const audioUrl = job.status === "COMPLETED" && job.audioKey ? await presignGet(job.audioKey) : null;
  return NextResponse.json({
    status: job.status,
    audioUrl,
    durationSec: job.durationSec,
    voice: job.voice,
    errorMessage: job.status === "FAILED" ? job.errorMessage : null,
  });
}
