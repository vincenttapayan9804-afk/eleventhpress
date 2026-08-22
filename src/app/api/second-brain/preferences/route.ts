import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { SECOND_BRAIN_VIEWS, FONT_PAIRING_IDS, isValidHexColor } from "@/lib/second-brain";

const DEFAULTS = {
  accentColor: "#8b7cf6",
  fontPairing: "fraunces-manrope",
  defaultView: "constellation",
};

/**
 * GET /api/second-brain/preferences
 * A missing row means "defaults" — see SecondBrainPreference's schema doc
 * comment — so this never 404s, it just returns DEFAULTS.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const pref = await db.secondBrainPreference.findUnique({ where: { userId: session.userId } });
  return NextResponse.json({
    preferences: pref
      ? { accentColor: pref.accentColor, fontPairing: pref.fontPairing, defaultView: pref.defaultView }
      : DEFAULTS,
  });
}

/**
 * PUT /api/second-brain/preferences
 * Body: { accentColor?, fontPairing?, defaultView? } — upserts, only the
 * keys present are changed (missing keys fall back to the existing row's
 * value, or DEFAULTS on first-ever write).
 */
export async function PUT(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    accentColor?: string;
    fontPairing?: string;
    defaultView?: string;
  };

  if (body.accentColor !== undefined && !isValidHexColor(body.accentColor)) {
    return NextResponse.json({ error: "accentColor must be a hex value like #8b7cf6" }, { status: 400 });
  }
  if (body.fontPairing !== undefined && !FONT_PAIRING_IDS.includes(body.fontPairing as any)) {
    return NextResponse.json({ error: `fontPairing must be one of ${FONT_PAIRING_IDS.join(", ")}` }, { status: 400 });
  }
  if (body.defaultView !== undefined && !SECOND_BRAIN_VIEWS.includes(body.defaultView as any)) {
    return NextResponse.json({ error: `defaultView must be one of ${SECOND_BRAIN_VIEWS.join(", ")}` }, { status: 400 });
  }

  const existing = await db.secondBrainPreference.findUnique({ where: { userId: session.userId } });
  const pref = await db.secondBrainPreference.upsert({
    where: { userId: session.userId },
    create: {
      userId: session.userId,
      accentColor: body.accentColor ?? DEFAULTS.accentColor,
      fontPairing: body.fontPairing ?? DEFAULTS.fontPairing,
      defaultView: body.defaultView ?? DEFAULTS.defaultView,
    },
    update: {
      accentColor: body.accentColor ?? existing?.accentColor,
      fontPairing: body.fontPairing ?? existing?.fontPairing,
      defaultView: body.defaultView ?? existing?.defaultView,
    },
  });

  return NextResponse.json({
    preferences: { accentColor: pref.accentColor, fontPairing: pref.fontPairing, defaultView: pref.defaultView },
  });
}
