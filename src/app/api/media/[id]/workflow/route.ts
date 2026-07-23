import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { PRIVILEGED_ROLES_LIST as PRIVILEGED_ROLES } from "@/lib/roles";

const ACTIONS: Record<string, { from: string[]; to: string }> = {
  PUBLISH: { from: ["DRAFT"], to: "PUBLISHED" },
  UNPUBLISH: { from: ["PUBLISHED"], to: "DRAFT" },
};

/** POST /api/media/[id]/workflow { action: PUBLISH | UNPUBLISH } — editorial-only. */
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

  const post = await db.mediaPost.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!transition.from.includes(post.status)) {
    return NextResponse.json({ error: `Cannot ${action} a post in status ${post.status}` }, { status: 400 });
  }

  const updated = await db.mediaPost.update({
    where: { id },
    data: {
      status: transition.to,
      publishedAt: action === "PUBLISH" ? new Date() : post.publishedAt,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: `MEDIA_POST_${action}`,
      entityType: "MEDIA_POST",
      entityId: post.id,
      metadata: JSON.stringify({ from: post.status, to: transition.to }),
    },
  });

  return NextResponse.json({ post: updated });
}
