import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_CONSENT_COOKIE_NAME,
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  isCookieConsentChoice,
} from "@/lib/cookie-consent";
import { READER_KEY_COOKIE } from "@/lib/paywall-meter";

/**
 * POST /api/cookie-consent — records the visitor's cookie choice. Done
 * server-side (rather than only via document.cookie) so that withdrawing
 * consent also deletes reader_key, which is HTTP-only and so can't be
 * removed by client script. The consent cookie itself stays script-readable
 * so the banner knows not to ask again.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { choice?: string } | null;
  const choice = body?.choice;
  if (!isCookieConsentChoice(choice)) {
    return NextResponse.json({ error: "choice must be \"all\" or \"necessary\"" }, { status: 400 });
  }
  const res = NextResponse.json({ choice });
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(COOKIE_CONSENT_COOKIE_NAME, choice, {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_CONSENT_MAX_AGE_SECONDS,
  });
  if (choice === "necessary" && req.cookies.get(READER_KEY_COOKIE)) {
    res.cookies.set(READER_KEY_COOKIE, "", { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 0 });
  }
  res.headers.set("Cache-Control", "no-store");
  return res;
}
