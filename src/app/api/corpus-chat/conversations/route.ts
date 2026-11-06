import { NextRequest, NextResponse } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { db } from "@/lib/db";
import { LIMITS, conversationRetentionDays, parsePayload, titleFromQuestion } from "@/lib/research-assistant";

/**
 * GET  /api/corpus-chat/conversations — the signed-in reader's saved
 *      Research Assistant conversations, pinned first, newest first.
 *      ?q= searches titles and message text; ?saved=1 lists the responses
 *      the reader saved, across conversations.
 * POST /api/corpus-chat/conversations — starts a conversation.
 *
 * Signed-in readers only: anonymous readers' conversations stay in their
 * own browser and never reach the server.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Sign in to sync conversations" }, { status: 401 });
  const userId = session.userId;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);

  if (req.nextUrl.searchParams.get("saved") === "1") {
    const saved = await db.researchMessage.findMany({
      where: { saved: true, conversation: { userId } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, content: true, payload: true, createdAt: true, conversation: { select: { id: true, title: true } } },
    });
    return NextResponse.json({
      saved: saved.map((m) => ({
        id: m.id,
        content: m.content,
        payload: parsePayload(m.payload),
        createdAt: m.createdAt,
        conversationId: m.conversation.id,
        conversationTitle: m.conversation.title,
      })),
    });
  }

  const where = q
    ? {
        userId,
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { messages: { some: { content: { contains: q, mode: "insensitive" as const } } } },
        ],
      }
    : { userId };
  const conversations = await db.researchConversation.findMany({
    where,
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    take: LIMITS.conversationsPerUser,
    select: {
      id: true,
      title: true,
      pinned: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
      // A snippet of the matching message for search results.
      ...(q
        ? {
            messages: {
              where: { content: { contains: q, mode: "insensitive" as const } },
              take: 1,
              select: { content: true },
            },
          }
        : {}),
    },
  });
  return NextResponse.json({
    retentionDays: conversationRetentionDays(),
    conversations: conversations.map((c: any) => ({
      id: c.id,
      title: c.title,
      pinned: c.pinned,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c._count.messages,
      ...(c.messages?.[0] ? { match: snippet(c.messages[0].content, q) } : {}),
    })),
  });
}

function snippet(text: string, q: string): string {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  const start = Math.max(0, i - 50);
  const s = text.slice(start, start + 160).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${s}${start + 160 < text.length ? "…" : ""}`;
}

export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Sign in to sync conversations" }, { status: 401 });
  let body: { title?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const count = await db.researchConversation.count({ where: { userId: session.userId } });
  if (count >= LIMITS.conversationsPerUser) {
    // Make room by removing the oldest unpinned conversation.
    const oldest = await db.researchConversation.findFirst({
      where: { userId: session.userId, pinned: false },
      orderBy: { updatedAt: "asc" },
      select: { id: true },
    });
    if (!oldest) {
      return NextResponse.json({ error: "You have reached the limit of saved conversations. Delete or unpin some to continue." }, { status: 409 });
    }
    await db.researchConversation.delete({ where: { id: oldest.id } });
  }
  const title = typeof body.title === "string" && body.title.trim() ? titleFromQuestion(body.title).slice(0, LIMITS.titleChars) : "New conversation";
  const conversation = await db.researchConversation.create({
    data: { userId: session.userId, title },
    select: { id: true, title: true, pinned: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json({ conversation: { ...conversation, messageCount: 0 } }, { status: 201 });
}
