import { randomBytes } from "crypto";

/**
 * A random per-account email-verification token — not a Prisma
 * schema-level default (see User.emailVerificationToken's schema
 * comment), generated explicitly at registration and cleared once
 * redeemed by GET /api/auth/verify-email.
 */
export function generateEmailVerificationToken(): string {
  return randomBytes(24).toString("hex");
}
