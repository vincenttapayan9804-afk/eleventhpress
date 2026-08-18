import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { runTranscriptionJob } from "@/lib/transcription";

const RESEARCH_LAB_ROLES = ["AUTHOR", "EXPERT", "REVIEWER", "EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"];

/**
 * POST /api/research-lab/transcription/[id]/retry
 * Re-runs a FAILED TranscriptionJob without requiring the researcher to
 * re-upload the audio — the file is already durably stored under this
 * job's audioKey, only the transcription attempt itself failed (e.g. a
 * transient model-load error). Owner-scoped, not admin-only, unlike the
 * platform's other job-retry routes: transcription jobs are personal
 * research artifacts with no editorial workflow, so the only person with
 * standing to retry one is whoever uploaded it.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!RESEARCH_LAB_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Not available for this role" }, { status: 403 });
  }

  const { id } = await params;
  const job = await db.transcriptionJob.findUnique({ where: { id } });
  if (!job || job.userId !== session.userId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (job.status !== "FAILED") {
    return NextResponse.json({ error: `Only a failed job can be retried (current status: ${job.status})` }, { status: 400 });
  }

  await runTranscriptionJob(id, { status: "FAILED" });

  const updated = await db.transcriptionJob.findUnique({ where: { id } });
  return NextResponse.json({ job: updated });
}
