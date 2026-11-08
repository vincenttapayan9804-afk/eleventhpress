import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

/** GET — the signed-in user's passkeys. DELETE ?id=… — remove one. PATCH { id, name } — rename. */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const passkeys = await db.passkey.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true, lastUsedAt: true },
  });
  return NextResponse.json({ passkeys });
}

export async function PATCH(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { id?: string; name?: string };
  const name = (b.name || "").trim().slice(0, 60);
  if (!b.id || !name) return NextResponse.json({ error: "id and name are required" }, { status: 400 });
  await db.passkey.updateMany({ where: { id: b.id, userId: session.userId }, data: { name } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const r = await db.passkey.deleteMany({ where: { id, userId: session.userId } });
  if (r.count) {
    await db.auditLog.create({ data: { userId: session.userId, action: "PASSKEY_REMOVED", entityType: "USER", entityId: session.userId } }).catch(() => {});
  }
  return NextResponse.json({ ok: r.count > 0 });
}
