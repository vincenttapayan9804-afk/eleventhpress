import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

/** POST to follow, DELETE to unfollow. Idempotent either way. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const { id: followingId } = await params;
  if (followingId === session.userId) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  await db.follow.upsert({
    where: { followerId_followingId: { followerId: session.userId, followingId } },
    create: { followerId: session.userId, followingId },
    update: {},
  });

  const followerCount = await db.follow.count({ where: { followingId } });
  return NextResponse.json({ following: true, followerCount });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const { id: followingId } = await params;

  await db.follow.deleteMany({ where: { followerId: session.userId, followingId } });

  const followerCount = await db.follow.count({ where: { followingId } });
  return NextResponse.json({ following: false, followerCount });
}
