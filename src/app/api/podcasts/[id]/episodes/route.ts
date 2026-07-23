import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { PRIVILEGED_ROLES_LIST as PRIVILEGED_ROLES } from "@/lib/roles";

/**
 * POST /api/podcasts/[id]/episodes
 * { episodeNumber, seasonNumber?, title, description, audioKey?, durationSec?, guests?, transcript? }
 * Creates a new DRAFT episode. Editorial-only.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, PRIVILEGED_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  const { id: podcastId } = await params;
  const podcast = await db.podcast.findUnique({ where: { id: podcastId } });
  if (!podcast) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as {
    episodeNumber?: number;
    seasonNumber?: number;
    title?: string;
    description?: string;
    audioKey?: string;
    durationSec?: number;
    guests?: string;
    transcript?: string;
  };
  if (body.episodeNumber == null || !body.title || !body.description) {
    return NextResponse.json({ error: "episodeNumber, title, and description are required" }, { status: 400 });
  }

  // Prisma's compound-unique accessor can't take null for a nullable
  // column in the key, so the duplicate check goes through a plain
  // multi-field where clause instead of podcastId_seasonNumber_episodeNumber.
  const dupe = await db.podcastEpisode.findFirst({
    where: { podcastId, seasonNumber: body.seasonNumber ?? null, episodeNumber: body.episodeNumber },
  });
  if (dupe) return NextResponse.json({ error: "An episode with that season/number already exists for this show" }, { status: 409 });

  const episode = await db.podcastEpisode.create({
    data: {
      podcastId,
      episodeNumber: body.episodeNumber,
      seasonNumber: body.seasonNumber,
      title: body.title,
      description: body.description,
      audioKey: body.audioKey,
      durationSec: body.durationSec,
      guests: body.guests,
      transcript: body.transcript,
      createdById: session.userId,
      status: "DRAFT",
    },
  });

  return NextResponse.json({ episode });
}
