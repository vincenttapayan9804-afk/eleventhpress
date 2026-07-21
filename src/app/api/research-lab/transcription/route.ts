import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { runTranscriptionJob } from "@/lib/transcription";

const RESEARCH_LAB_ROLES = ["AUTHOR", "EXPERT", "REVIEWER", "EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"];

/**
 * POST /api/research-lab/transcription
 * Creates and runs a TranscriptionJob over an already-uploaded WAV file.
 * The upload itself goes through the existing presign-local flow
 * (POST /api/storage/presign-local with bucket: "research-audio", same
 * as every other upload in this app), which is what actually validates
 * content-type/size/magic-bytes — this route just needs the resulting key
 * to belong to that bucket and to this user.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!RESEARCH_LAB_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Not available for this role" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { audioKey?: string; fileName?: string };
  const audioKey = body.audioKey;
  const fileName = body.fileName || "recording.wav";
  if (!audioKey || !audioKey.startsWith(`research-audio/${session.userId}/`)) {
    return NextResponse.json({ error: "Invalid or missing audioKey — upload via /api/storage/presign-local first" }, { status: 400 });
  }

  const job = await db.transcriptionJob.create({
    data: { userId: session.userId, audioKey, fileName, status: "QUEUED" },
  });
  await runTranscriptionJob(job.id, { status: "QUEUED" });

  const finished = await db.transcriptionJob.findUnique({ where: { id: job.id } });
  return NextResponse.json({ success: finished?.status === "COMPLETED", job: finished });
}

/**
 * GET /api/research-lab/transcription
 * Returns the caller's own recent transcription jobs.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!RESEARCH_LAB_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Not available for this role" }, { status: 403 });
  }

  const jobs = await db.transcriptionJob.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return NextResponse.json({ jobs });
}
