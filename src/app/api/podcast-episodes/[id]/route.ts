import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { presignGet } from "@/lib/storage";
import { getSessionFromHeaders, requireRole } from "@/lib/auth";
import { PRIVILEGED_ROLES_LIST as PRIVILEGED_ROLES } from "@/lib/roles";

/** GET /api/podcast-episodes/[id] — public for PUBLISHED episodes, editorial-only otherwise. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const episode = await db.podcastEpisode.findUnique({ where: { id }, include: { podcast: true } });
  if (!episode) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = getSessionFromHeaders(req.headers);
  const isPrivileged = !!session && PRIVILEGED_ROLES.includes(session.role);
  if (episode.status !== "PUBLISHED" && !isPrivileged) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    episode: { ...episode, audioUrl: episode.audioKey ? await presignGet(episode.audioKey) : null },
  });
}

/** PATCH /api/podcast-episodes/[id] { title?, description?, audioKey?, durationSec?, guests?, transcript? } — editorial-only. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, PRIVILEGED_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const existing = await db.podcastEpisode.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as {
    title?: string;
    description?: string;
    audioKey?: string;
    durationSec?: number;
    guests?: string;
    transcript?: string;
  };

  const episode = await db.podcastEpisode.update({
    where: { id },
    data: {
      title: body.title ?? existing.title,
      description: body.description ?? existing.description,
      audioKey: body.audioKey ?? existing.audioKey,
      durationSec: body.durationSec ?? existing.durationSec,
      guests: body.guests ?? existing.guests,
      transcript: body.transcript ?? existing.transcript,
    },
  });

  return NextResponse.json({ episode });
}

/** DELETE /api/podcast-episodes/[id] — editorial-only, DRAFT episodes only. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, PRIVILEGED_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const existing = await db.podcastEpisode.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.status === "PUBLISHED") {
    return NextResponse.json({ error: "A published episode can't be deleted" }, { status: 400 });
  }

  await db.podcastEpisode.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
