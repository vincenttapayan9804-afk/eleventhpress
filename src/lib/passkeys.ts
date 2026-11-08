import jwt from "jsonwebtoken";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Passkeys (WebAuthn): passwordless, phishing-resistant sign-in with Face ID,
 * Touch ID, Windows Hello, Android or a security key. The relying party is
 * the host the visitor is on, so passkeys work on each tenant's own domain.
 * Challenges travel in a short-lived signed httpOnly cookie, so no server
 * state is needed between the two steps of a ceremony.
 */

const CHALLENGE_COOKIE = "epip_webauthn";
const SECRET =
  process.env.SESSION_SECRET || (process.env.NODE_ENV !== "production" ? "epip-dev-only-insecure-secret-do-not-use-in-prod" : "");

export function relyingParty(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "");
  const rpID = host.split(":")[0];
  return { rpID, origin: `${proto}://${host}` };
}

export function setChallenge(res: NextResponse, challenge: string, purpose: "register" | "login", userId?: string) {
  const token = jwt.sign({ challenge, purpose, ...(userId ? { userId } : {}) }, SECRET, { expiresIn: "5m" });
  res.cookies.set(CHALLENGE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth/passkeys",
    maxAge: 300,
  });
}

export function readChallenge(req: NextRequest, purpose: "register" | "login"): { challenge: string; userId?: string } | null {
  const raw = req.cookies.get(CHALLENGE_COOKIE)?.value;
  if (!raw) return null;
  try {
    const d = jwt.verify(raw, SECRET) as { challenge?: string; purpose?: string; userId?: string };
    if (d.purpose !== purpose || typeof d.challenge !== "string") return null;
    return { challenge: d.challenge, userId: d.userId };
  } catch {
    return null;
  }
}

export function clearChallenge(res: NextResponse) {
  res.cookies.set(CHALLENGE_COOKIE, "", { path: "/api/auth/passkeys", maxAge: 0 });
}

/** "iCloud Keychain on iPhone"-style default name from the user agent. */
export function defaultPasskeyName(ua: string | null): string {
  if (!ua) return "Passkey";
  if (/iPhone|iPad/.test(ua)) return "iPhone or iPad";
  if (/Mac OS X/.test(ua)) return "Mac";
  if (/Android/.test(ua)) return "Android device";
  if (/Windows/.test(ua)) return "Windows Hello";
  return "Passkey";
}
