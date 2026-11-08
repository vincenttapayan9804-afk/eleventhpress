/**
 * Pure helpers for emailed two-factor codes (no db / network), so they can
 * be unit-tested in isolation. See src/lib/twofactor-email.ts for issuing
 * and redeeming codes.
 */
import crypto from "crypto";

export const EMAIL_CODE_TTL_MINUTES = 10;
export const EMAIL_CODE_MAX_ATTEMPTS = 5;

function hmacKey(): string {
  return (
    process.env.SESSION_SECRET ||
    (process.env.NODE_ENV !== "production" ? "epip-dev-only-insecure-secret-do-not-use-in-prod" : "")
  );
}

/** A uniformly random 6-digit code ("004217" is valid). */
export function generateEmailCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Codes are stored only as an HMAC bound to the account they were issued for. */
export function hashEmailCode(userId: string, code: string): string {
  return crypto.createHmac("sha256", hmacKey()).update(`${userId}:${code}`).digest("hex");
}

export function emailCodeMatches(userId: string, code: string, storedHash: string | null | undefined): boolean {
  const normalized = code.replace(/\s+/g, "");
  if (!storedHash || !/^\d{6}$/.test(normalized)) return false;
  const a = Buffer.from(hashEmailCode(userId, normalized), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** "maria.santos@uni.edu" -> "ma•••••••@uni.edu" — enough to recognise, not to harvest. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const keep = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${keep}${"•".repeat(Math.max(3, local.length - keep.length))}@${domain}`;
}
