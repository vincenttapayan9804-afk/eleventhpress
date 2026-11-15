import { NextRequest, NextResponse } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { db } from "@/lib/db";
import { LIMITS } from "@/lib/research-assistant";
import { resolveTenantFromHeaders } from "@/lib/tenant";

/**
 * POST /api/corpus-chat/shared/[token]/copy — "Continue this conversation":
 * copies a shared conversation into the signed-in reader's own history,
 * where they can ask follow-ups. The original is untouched.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Sign in to continue this conversation" }, { status: 401 });
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return NextResponse.json({ error: "This shared conversation isn't available." }, { status: 404 });
  const tenant = await resolveTenantFromHeaders(req.headers).catch(() => null);
  const source = await db.researchConversation.findFirst({
    where: { shareToken: token },
    select: {
      title: true,
      tenantId: true,
      messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true, payload: true } },
    },
  });
  if (!source || (source.tenantId && tenant && source.tenantId !== tenant.id)) {
    return NextResponse.json({ error: "This shared conversation isn't available." }, { status: 404 });
  }
  const count = await db.researchConversation.count({ where: { userId: session.userId } });
  if (count >= LIMITS.conversationsPerUser) {
    return NextResponse.json({ error: "You have reached the limit of saved conversations. Delete some to continue this one." }, { status: 409 });
  }
  const base = Date.now();
  const conversation = await db.researchConversation.create({
    data: {
      userId: session.userId,
      tenantId: tenant?.id ?? source.tenantId,
      title: source.title.slice(0, LIMITS.titleChars),
      messages: { create: source.messages.slice(0, LIMITS.messagesPerConversation).map((m, i) => ({ ...m, createdAt: new Date(base + i) })) },
    },
    select: { id: true },
  });
  return NextResponse.json({ conversationId: conversation.id }, { status: 201 });
}
