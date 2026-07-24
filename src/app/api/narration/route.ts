import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { presignGet } from "@/lib/storage";
import {
  runNarrationJob,
  KOKORO_VOICES,
  DEFAULT_KOKORO_VOICE,
  isKnownKokoroVoice,
  type NarrationContentType,
} from "@/lib/kokoro-tts";

const CONTENT_TYPES: NarrationContentType[] = ["ARTICLE", "MAGAZINE_PIECE", "MEDIA_POST"];
const EDITORIAL_ROLES = ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"];

/**
 * POST /api/narration
 * Creates (or re-triggers) a NarrationJob for a published Article,
 * MagazinePiece, or MediaPost and runs it synchronously — same pattern as
 * the magazine issue workflow's SEND_TO_PRODUCTION action. Editorial roles
 * only: narration should be a deliberate editorial action, not automatic
 * on every publish, since it takes real (if free) compute time per request.
 *
 * `voice` selects one of the fixed KOKORO_VOICES personas (defaults to the
 * Female voice) — each (contentType, contentId, voice) triple is its own
 * NarrationJob, so an editor can generate a Male and a Female narration of
 * the same item without one overwriting the other.
 */
export async function POST(req: NextRequest) {
  const auth = requireRole(req.headers, EDITORIAL_ROLES);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { session } = auth;

  const body = (await req.json().catch(() => ({}))) as { contentType?: string; contentId?: string; voice?: string };
  const { contentType, contentId } = body;
  const voice = body.voice || DEFAULT_KOKORO_VOICE;
  if (!contentType || !contentId || !CONTENT_TYPES.includes(contentType as NarrationContentType)) {
    return NextResponse.json({ error: "contentType must be one of ARTICLE, MAGAZINE_PIECE, MEDIA_POST" }, { status: 400 });
  }
  if (!isKnownKokoroVoice(voice)) {
    return NextResponse.json({ error: `voice must be one of ${KOKORO_VOICES.map((v) => v.id).join(", ")}` }, { status: 400 });
  }

  const job = await db.narrationJob.upsert({
    where: { contentType_contentId_voice: { contentType, contentId, voice } },
    create: { contentType, contentId, voice, createdById: session.userId, status: "QUEUED" },
    update: { status: "QUEUED", errorMessage: null, audioKey: null },
  });

  await runNarrationJob(job.id, { status: "QUEUED" });

  const finished = await db.narrationJob.findUnique({ where: { id: job.id } });
  return NextResponse.json({ success: finished?.status === "COMPLETED", job: finished });
}

/**
 * GET /api/narration?contentType=ARTICLE&contentId=...
 * Public — returns every generated narration persona for a content item
 * (plus a fetchable audio URL for each one that's COMPLETED), so a public
 * reader view can show a "Listen" player and, when more than one persona
 * exists, a Male/Female picker — never fabricating a persona that wasn't
 * actually generated.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const contentType = searchParams.get("contentType");
  const contentId = searchParams.get("contentId");
  if (!contentType || !contentId || !CONTENT_TYPES.includes(contentType as NarrationContentType)) {
    return NextResponse.json({ error: "contentType must be one of ARTICLE, MAGAZINE_PIECE, MEDIA_POST" }, { status: 400 });
  }

  const jobs = await db.narrationJob.findMany({
    where: { contentType, contentId },
    orderBy: { voice: "asc" },
  });

  const narrations = await Promise.all(
    jobs.map(async (job) => {
      const meta = KOKORO_VOICES.find((v) => v.id === job.voice);
      return {
        voice: job.voice,
        label: meta?.label || job.voice,
        gender: meta?.gender || null,
        status: job.status,
        audioUrl: job.status === "COMPLETED" && job.audioKey ? await presignGet(job.audioKey) : null,
        durationSec: job.durationSec,
        errorMessage: job.status === "FAILED" ? job.errorMessage : null,
      };
    })
  );

  return NextResponse.json({ narrations });
}
