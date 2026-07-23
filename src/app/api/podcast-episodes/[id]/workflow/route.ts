import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { PRIVILEGED_ROLES_LIST as PRIVILEGED_ROLES } from "@/lib/roles";

const ACTIONS: Record<string, { from: string[]; to: string }> = {
  PUBLISH: { from: ["DRAFT"], to: "PUBLISHED" },
  UNPUBLISH: { from: ["PUBLISHED"], to: "DRAFT" },
};

/**
 * POST /api/podcast-episodes/[id]/workflow { action }
 * A much smaller state machine than Book/MagazineIssue's — an episode is a
 * single uploaded audio file, not a compiled multi-piece document, so
 * there's no production step to gate on (see PodcastEpisode's schema
 * comment). Editorial-only.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!PRIVILEGED_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

  const { id } = await params;
  const { action } = (await req.json()) as { action?: string };
  const transition = action ? ACTIONS[action] : undefined;
  if (!transition) {
    return NextResponse.json({ error: `action must be one of ${Object.keys(ACTIONS).join(", ")}` }, { status: 400 });
  }

  const episode = await db.podcastEpisode.findUnique({ where: { id } });
  if (!episode) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!transition.from.includes(episode.status)) {
    return NextResponse.json({ error: `Cannot ${action} an episode in status ${episode.status}` }, { status: 400 });
  }
  if (action === "PUBLISH" && !episode.audioKey) {
    return NextResponse.json({ error: "An episode needs an uploaded audio file before it can be published" }, { status: 400 });
  }

  const updated = await db.podcastEpisode.update({
    where: { id },
    data: {
      status: transition.to,
      publishedAt: action === "PUBLISH" ? new Date() : episode.publishedAt,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: `PODCAST_EPISODE_${action}`,
      entityType: "PODCAST_EPISODE",
      entityId: episode.id,
      metadata: JSON.stringify({ from: episode.status, to: transition.to }),
    },
  });

  return NextResponse.json({ episode: updated });
}
