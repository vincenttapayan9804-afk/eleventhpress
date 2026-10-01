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

/** Referral milestones, ascending — a referral count earns every badge
 * at or below it, but GET /api/account/referrals surfaces only the
 * highest one reached. Thresholds are deliberately low: the point of a
 * referral badge is a fast, visible first win, not a hard-to-reach goal. */
export const REFERRAL_MILESTONES = [
  { threshold: 3, label: "Advocate" },
  { threshold: 10, label: "Ambassador" },
  { threshold: 25, label: "Champion" },
] as const;

export function highestReferralMilestone(totalReferred: number): string | null {
  let label: string | null = null;
  for (const m of REFERRAL_MILESTONES) {
    if (totalReferred >= m.threshold) label = m.label;
  }
  return label;
}
