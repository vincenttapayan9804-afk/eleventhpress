import { NextRequest, NextResponse } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import {
  CATEGORY_LABELS,
  EMAIL_MODES,
  getPreferences,
  isCategory,
  NOTIFICATION_CATEGORIES,
  savePreferences,
  type EmailMode,
} from "@/lib/notification-prefs";

/** GET/PUT /api/notifications/preferences — the signed-in user's notification email preferences. */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const prefs = await getPreferences(session.userId);
  return NextResponse.json({
    preferences: prefs,
    categories: NOTIFICATION_CATEGORIES.map((key) => ({ key, ...CATEGORY_LABELS[key] })),
  });
}

export async function PUT(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { emailMode?: string; mutedCategories?: unknown };
  if (!body.emailMode || !(EMAIL_MODES as readonly string[]).includes(body.emailMode)) {
    return NextResponse.json({ error: "emailMode must be INSTANT, DAILY or OFF" }, { status: 400 });
  }
  const muted = Array.isArray(body.mutedCategories) ? body.mutedCategories.filter(isCategory) : [];
  const preferences = await savePreferences(session.userId, { emailMode: body.emailMode as EmailMode, mutedCategories: muted });
  return NextResponse.json({ preferences });
}
