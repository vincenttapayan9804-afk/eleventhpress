import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractRequestIp } from "@/lib/institutions";
import { checkRateLimit } from "@/lib/ratelimit";
import { heartbeatPresence, getPresenceCount } from "@/lib/presence";

/**
 * POST /api/articles/[id]/presence
 * Body: { sessionId: string } — a random per-tab id the client generates
 * once and reuses for every heartbeat, so the same reader refreshing their
 * own presence never inflates the count (src/lib/presence.ts).
 *
 * Public, no login required — same reasoning as the article route itself.
 * Rate-limited generously since the client polls this on an interval
 * (article-view.tsx's PRESENCE_HEARTBEAT_MS), not per user action.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: articleId } = await params;

  const ip = extractRequestIp(req.headers);
  const rl = await checkRateLimit(`presence:${ip}`, 20, 60);
  if (!rl.ok) {
    return NextResponse.json({ error: rl.message }, { status: 429 });
  }

  let body: { sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const sessionId = (body.sessionId || "").trim();
  if (!sessionId || sessionId.length > 100) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const article = await db.article.findUnique({ where: { id: articleId }, select: { status: true } });
  if (!article || article.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  await heartbeatPresence(articleId, sessionId);
  const result = await getPresenceCount(articleId);
  return NextResponse.json(result);
}
