import { randomBytes } from "crypto";

/**
 * A random per-account referral code, e.g. "a1b2c3d4e5f6". Not a Prisma
 * schema-level default (see User.referralCode's schema comment) — called
 * explicitly at registration for a new account, and lazily backfilled by
 * GET /api/account/referrals for one that predates this field.
 */
export function generateReferralCode(): string {
  return randomBytes(6).toString("hex");
}
