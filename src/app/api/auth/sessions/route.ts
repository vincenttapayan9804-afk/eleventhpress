import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { listSessions, revokeOtherSessions, revokeSession } from "@/lib/user-sessions";

/**
 * Where you're signed in.
 * GET    — active sessions (device, approximate location, last active), the current one marked.
 * DELETE ?id=… — sign out that session.
 * POST   { action: "signOutOthers" } — sign out every other session.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const rows = await listSessions(session.userId);
  return NextResponse.json({
    sessions: rows.map((r) => ({ id: r.id, device: r.device, location: r.location, createdAt: r.createdAt, lastSeenAt: r.lastSeenAt, current: r.id === session.sid })),
    currentTracked: !!session.sid,
  });
}

export async function DELETE(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  if (id === session.sid) return NextResponse.json({ error: "Use Sign out to end this session" }, { status: 400 });
  const ok = await revokeSession(session.userId, id);
  if (ok) {
    await db.auditLog.create({ data: { userId: session.userId, action: "SESSION_REVOKED", entityType: "USER", entityId: session.userId } }).catch(() => {});
  }
  return NextResponse.json({ ok });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "signOutOthers") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const count = await revokeOtherSessions(session.userId, session.sid);
  await db.auditLog
    .create({ data: { userId: session.userId, action: "SESSIONS_REVOKED_OTHERS", entityType: "USER", entityId: session.userId, metadata: JSON.stringify({ count }) } })
    .catch(() => {});
  return NextResponse.json({ ok: true, count });
}
