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

export function getSessionFromHeaders(headers: Headers): SessionPayload | null {
  const auth = headers.get("authorization") || headers.get("Authorization");
  if (!auth) return null;
  const token = auth.replace(/^Bearer\s+/i, "");
  return verifyToken(token);
}
