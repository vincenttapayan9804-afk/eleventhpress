import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

/**
 * GET /api/notifications  — current user's notifications (latest 50) and unread count.
 *   ?count=1 returns only { unread } (the header bell polls this).
 * POST /api/notifications — mark all (or single) as read.
 *   Body: { notificationId?: string }
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (req.nextUrl.searchParams.get("count") === "1") {
    const unread = await db.notification.count({ where: { userId: session.userId, read: false } });
    return NextResponse.json({ unread });
  }
  const [notifications, unread] = await Promise.all([db.notification.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { article: { select: { title: true, doi: true } } },
  }), db.notification.count({ where: { userId: session.userId, read: false } })]);
  return NextResponse.json({
    unread,
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      category: n.category,
      link: n.link,
      articleId: n.articleId,
      read: n.read,
      createdAt: n.createdAt,
      article: n.article,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { notificationId } = body as { notificationId?: string };

  if (notificationId) {
    await db.notification.updateMany({
      where: { id: notificationId, userId: session.userId },
      data: { read: true },
    });
  } else {
    await db.notification.updateMany({
      where: { userId: session.userId, read: false },
      data: { read: true },
    });
  }
  return NextResponse.json({ ok: true });
}
