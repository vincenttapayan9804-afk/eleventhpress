import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/ratelimit";
import { requestBaseUrl, resolveTenantFromHeaders } from "@/lib/tenant";

/**
 * POST   /api/corpus-chat/conversations/[id]/share — creates (or returns)
 *        a read-only link to the reader's conversation.
 * DELETE /api/corpus-chat/conversations/[id]/share — revokes it; the old
 *        link stops working at once.
 *
 * Anyone with the link can read the conversation as it currently stands
 * (questions, answers, citations and sources), on the site of the
 * institution it was held on. Nothing else about the reader is shown.
 */
async function owned(req: NextRequest, id: string) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return { error: NextResponse.json({ error: "Sign in to share conversations" }, { status: 401 }) };
  const c = await db.researchConversation.findFirst({ where: { id, userId: session.userId }, select: { id: true, shareToken: true } });
  if (!c) return { error: NextResponse.json({ error: "Conversation not found" }, { status: 404 }) };
  return { c, session };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await owned(req, id);
  if (check.error) return check.error;
  const rl = await checkRateLimit(`corpus-chat-share:${check.session.userId}`, 30, 3600);
  if (!rl.ok) return NextResponse.json({ error: rl.message }, { status: 429 });
  const token = check.c.shareToken ?? randomBytes(18).toString("base64url");
  if (!check.c.shareToken) await db.researchConversation.update({ where: { id }, data: { shareToken: token, sharedAt: new Date() } });
  const tenant = await resolveTenantFromHeaders(req.headers).catch(() => null);
  const base = await requestBaseUrl(tenant);
  return NextResponse.json({ token, url: `${base}/research/shared/${token}` });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await owned(req, id);
  if (check.error) return check.error;
  await db.researchConversation.update({ where: { id }, data: { shareToken: null, sharedAt: null } });
  return NextResponse.json({ ok: true });
}
