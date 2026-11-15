import { NextRequest, NextResponse } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { db } from "@/lib/db";
import { LIMITS } from "@/lib/research-assistant";

/**
 * POST /api/corpus-chat/conversations/[id]/branch {upTo: messageId} —
 * "Branch from here": a new conversation holding a copy of this one up to
 * and including that answer, so the reader can explore another direction
 * without losing the original thread. Copied on the server, from the
 * reader's own stored messages.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  let body: { upTo?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const source = await db.researchConversation.findFirst({
    where: { id, userId: session.userId },
    select: {
      title: true,
      tenantId: true,
      messages: { orderBy: { createdAt: "asc" }, select: { id: true, role: true, content: true, payload: true, createdAt: true } },
    },
  });
  if (!source) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  const end = typeof body.upTo === "string" ? source.messages.findIndex((m) => m.id === body.upTo) : source.messages.length - 1;
  if (end < 0) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  const copied = source.messages.slice(0, end + 1);
  const count = await db.researchConversation.count({ where: { userId: session.userId } });
  if (count >= LIMITS.conversationsPerUser) {
    return NextResponse.json({ error: "You have reached the limit of saved conversations. Delete some to branch this one." }, { status: 409 });
  }
  const title = `${source.title.replace(/\s*\(branch\)$/, "").slice(0, LIMITS.titleChars - 9)} (branch)`;
  const base = Date.now();
  const conversation = await db.researchConversation.create({
    data: {
      userId: session.userId,
      tenantId: source.tenantId,
      title,
      messages: {
        create: copied.map((m, i) => ({ role: m.role, content: m.content, payload: m.payload, createdAt: new Date(base + i) })),
      },
    },
    select: { id: true, title: true, pinned: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json({ conversation: { ...conversation, messageCount: copied.length } }, { status: 201 });
}
