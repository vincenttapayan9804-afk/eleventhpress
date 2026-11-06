import { NextRequest, NextResponse } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { db } from "@/lib/db";
import { LIMITS, serializePayload } from "@/lib/research-assistant";

/**
 * POST /api/corpus-chat/conversations/[id]/messages — appends a question
 * and its answer ({messages: [{role, content, payload?}]}) to the reader's
 * own conversation. Returns the new message ids in order.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const conversation = await db.researchConversation.findFirst({
    where: { id, userId: session.userId },
    select: { id: true, _count: { select: { messages: true } } },
  });
  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const raw = Array.isArray(body.messages) ? body.messages.slice(0, 4) : [];
  const messages = raw
    .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m: any) => ({
      role: m.role as string,
      content: String(m.content).slice(0, LIMITS.messageChars),
      payload: m.role === "assistant" ? serializePayload(m.payload) : null,
    }));
  if (messages.length === 0) return NextResponse.json({ error: "No messages to save" }, { status: 400 });
  if (conversation._count.messages + messages.length > LIMITS.messagesPerConversation) {
    return NextResponse.json({ error: "This conversation is full. Start a new conversation to continue." }, { status: 409 });
  }

  // Sequential creates so createdAt preserves question-then-answer order.
  const ids: string[] = [];
  const base = Date.now();
  for (const [i, m] of messages.entries()) {
    const created = await db.researchMessage.create({
      data: { conversationId: id, ...m, createdAt: new Date(base + i) },
      select: { id: true },
    });
    ids.push(created.id);
  }
  await db.researchConversation.update({ where: { id }, data: { updatedAt: new Date() } });
  return NextResponse.json({ ids }, { status: 201 });
}
