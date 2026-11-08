import { NextRequest, NextResponse } from "next/server";
import { applyUnsubscribe, readUnsubscribeToken } from "@/lib/notification-prefs";

/**
 * POST /api/notifications/unsubscribe?token=… — one-click unsubscribe
 * (RFC 8058 List-Unsubscribe-Post, sent by mail clients) and the
 * confirmation button on /unsubscribe. The signed token names the account
 * and category, so no sign-in is needed.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const parsed = readUnsubscribeToken(token);
  if (!parsed) return NextResponse.json({ error: "This unsubscribe link isn't valid." }, { status: 400 });
  await applyUnsubscribe(parsed.userId, parsed.category);
  return NextResponse.json({ ok: true, category: parsed.category });
}
