import { NextRequest, NextResponse } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { db } from "@/lib/db";
import { LIMITS, parsePayload } from "@/lib/research-assistant";

/**
 * GET    /api/corpus-chat/conversations/[id] — a conversation with its messages.
 * PATCH  /api/corpus-chat/conversations/[id] — rename ({title}) or pin ({pinned}).
 * DELETE /api/corpus-chat/conversations/[id] — deletes it and its messages.
 *
 * Only the reader who owns the conversation can see or change it; anyone
 * else gets a 404, so ids can't be probed.
 */
async function owned(req: NextRequest, id: string) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return { error: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }) };
  const conversation = await db.researchConversation.findFirst({ where: { id, userId: session.userId }, select: { id: true } });
  if (!conversation) return { error: NextResponse.json({ error: "Conversation not found" }, { status: 404 }) };
  return { conversation };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await owned(req, id);
  if (check.error) return check.error;
  const c = await db.researchConversation.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      pinned: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true, payload: true, saved: true, createdAt: true },
      },
    },
  });
  if (!c) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  return NextResponse.json({
    conversation: { ...c, messages: c.messages.map((m) => ({ ...m, payload: parsePayload(m.payload) })) },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await owned(req, id);
  if (check.error) return check.error;
  let body: { title?: unknown; pinned?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const data: { title?: string; pinned?: boolean } = {};
  if (typeof body.title === "string") {
    const title = body.title.replace(/\s+/g, " ").trim().slice(0, LIMITS.titleChars);
    if (!title) return NextResponse.json({ error: "Title can't be empty" }, { status: 400 });
    data.title = title;
  }
  if (typeof body.pinned === "boolean") data.pinned = body.pinned;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  const conversation = await db.researchConversation.update({
    where: { id },
    data,
    select: { id: true, title: true, pinned: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json({ conversation });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await owned(req, id);
  if (check.error) return check.error;
  await db.researchConversation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
