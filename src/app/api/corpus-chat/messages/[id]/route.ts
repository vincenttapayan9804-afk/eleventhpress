import { NextRequest, NextResponse } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { db } from "@/lib/db";
import { LIMITS, serializePayload } from "@/lib/research-assistant";

/**
 * PATCH /api/corpus-chat/messages/[id] — on the reader's own saved
 * answer: {saved} bookmarks it ("Save important responses"); {content,
 * payload} replaces it with a regenerated answer.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const message = await db.researchMessage.findFirst({
    where: { id, conversation: { userId: session.userId } },
    select: { id: true, role: true, conversationId: true },
  });
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  let body: { saved?: unknown; content?: unknown; payload?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const data: { saved?: boolean; content?: string; payload?: string | null } = {};
  if (typeof body.saved === "boolean") data.saved = body.saved;
  if (typeof body.content === "string" && body.content.trim() && message.role === "assistant") {
    data.content = body.content.slice(0, LIMITS.messageChars);
    data.payload = serializePayload(body.payload);
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  await db.researchMessage.update({ where: { id }, data });
  await db.researchConversation.update({ where: { id: message.conversationId }, data: { updatedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
