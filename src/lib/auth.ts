/**
 * Auth helpers — real bcrypt password hashing + signed, expiring JWT
 * sessions. Same function signatures as the original sandbox-only mock
 * (crypto.createHash SHA-256 + unsigned base64 "tokens"), so every caller
 * across the app works unchanged.
 */
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const BCRYPT_ROUNDS = 10;
const TOKEN_TTL = "7d";

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  (process.env.NODE_ENV !== "production" ? "epip-dev-only-insecure-secret-do-not-use-in-prod" : undefined);

if (!SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET environment variable is required in production — sessions cannot be signed without it."
  );
}

/** The scheme every account created before this change used. Kept only for
 * verifyPassword's backward-compat path below — never used for new hashes. */
function legacySha256Hash(plain: string): string {
  return crypto.createHash("sha256").update(`epip:${plain}`).digest("hex");
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): boolean {
  // bcrypt hashes always start with $2a$/$2b$/$2y$. Anything else is a
  // pre-migration legacy SHA-256 hash from before this change — still
  // checked so already-seeded demo accounts aren't locked out, but never
  // produced for new passwords.
  if (!hash.startsWith("$2")) {
    return legacySha256Hash(plain) === hash;
  }
  return bcrypt.compareSync(plain, hash);
}

export interface SessionPayload {
  userId: string;
  email: string;
  role: string;
  fullName: string;
}

export function signToken(payload: SessionPayload): string {
  return jwt.sign(payload, SESSION_SECRET!, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, SESSION_SECRET!);
    if (typeof decoded !== "object" || decoded === null) return null;
    const { userId, email, role, fullName } = decoded as Record<string, unknown>;
    if (
      typeof userId !== "string" ||
      typeof email !== "string" ||
      typeof role !== "string" ||
      typeof fullName !== "string"
    ) {
      return null;
    }
    return { userId, email, role, fullName };
  } catch {
    return null;
  }
}

/** Name of the httpOnly cookie carrying the session JWT. */
export const SESSION_COOKIE_NAME = "epip_session";

/**
 * Options for the httpOnly session cookie. `secure` is conditional on
 * NODE_ENV (not hardcoded true) because local `bun dev` runs over plain
 * HTTP — a hardcoded `secure: true` cookie would silently never be sent in
 * local dev. `sameSite: "lax"` (not "strict") because the ORCID OAuth
 * callback is a cross-site top-level GET redirect landing back on this
 * origin; "strict" would drop the cookie on that redirect and break
 * login-via-ORCID.
 */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days, matching TOKEN_TTL
  };
}

/**
 * Reads the session from either the Authorization header (legacy — kept so
 * any request still sending a Bearer token during rollout keeps working) or
 * the httpOnly session cookie, checked second. Both live in the same
 * `Headers` object this already receives (the raw `Cookie` header), so
 * every existing call site keeps working unchanged — only this function's
 * internals grew a second source to check.
 */
export function getSessionFromHeaders(headers: Headers): SessionPayload | null {
  const auth = headers.get("authorization") || headers.get("Authorization");
  if (auth) {
    const session = verifyToken(auth.replace(/^Bearer\s+/i, ""));
    if (session) return session;
  }
  const cookieHeader = headers.get("cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
    if (match) return verifyToken(decodeURIComponent(match[1]));
  }
  return null;
}

/** True when a stored password hash is the pre-bcrypt legacy SHA-256 scheme — callers use this to transparently re-hash with bcrypt on next successful login. */
export function needsPasswordRehash(hash: string): boolean {
  return !hash.startsWith("$2");
}

const PENDING_2FA_TTL = "5m";

/**
 * A deliberately narrow, short-lived token scoping only "this specific
 * user just proved their password" — issued instead of a real session when
 * `User.twoFactorEnabled` is true, and only ever accepted by
 * POST /api/auth/2fa/challenge to complete login. It cannot be used
 * anywhere a real session is required: getSessionFromHeaders() only ever
 * calls verifyToken() (below), never this function, so a leaked pending
 * token grants no access beyond attempting the 2FA challenge itself before
 * it expires.
 */
export function signPendingTwoFactorToken(userId: string): string {
  return jwt.sign({ userId, kind: "2fa_pending" }, SESSION_SECRET!, { expiresIn: PENDING_2FA_TTL });
}

export function verifyPendingTwoFactorToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, SESSION_SECRET!);
    if (typeof decoded !== "object" || decoded === null) return null;
    const { userId, kind } = decoded as Record<string, unknown>;
    if (kind !== "2fa_pending" || typeof userId !== "string") return null;
    return { userId };
  } catch {
    return null;
  }
}
