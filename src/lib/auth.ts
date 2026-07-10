/**
 * Auth helpers — password hashing + JWT-like session mock.
 * Production deployments should use NextAuth + bcrypt; this is a sandbox-safe
 * stand-in that mirrors the same shape so swapping implementations is trivial.
 */
import crypto from "crypto";

export function hashPassword(plain: string): string {
  return crypto.createHash("sha256").update(`epip:${plain}`).digest("hex");
}

export function verifyPassword(plain: string, hash: string): boolean {
  return hashPassword(plain) === hash;
}

export interface SessionPayload {
  userId: string;
  email: string;
  role: string;
  fullName: string;
}

export function signToken(payload: SessionPayload): string {
  // NOTE: This is NOT a cryptographic JWT. Sandbox-only.
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `epip.${body}.mock`;
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== "epip") return null;
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
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
