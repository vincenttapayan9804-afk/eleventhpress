/**
 * DB-backed account lockout — a second, slower-to-trip line of defense
 * layered on top of the existing per-IP/per-account rate limit
 * (src/lib/ratelimit.ts). The rate limit is fast and cheap but fails open
 * when Upstash isn't configured (see ratelimit.ts's "simulation mode");
 * this one is enforced unconditionally since it's backed by the primary
 * database, not an optional external service.
 */

/** Consecutive failures before the account locks. */
export const LOCK_THRESHOLD = 5;

/** Base lockout duration; escalates each time the threshold is crossed again. */
const BASE_LOCKOUT_MINUTES = 15;

/** Hard cap so a very long attack history doesn't lock a real user out indefinitely. */
const MAX_LOCKOUT_MINUTES = 60;

/**
 * Given the failure count *after* incrementing for this attempt, returns
 * the lockout duration in minutes if this attempt just crossed a multiple
 * of LOCK_THRESHOLD, or null if no new lockout should be applied (either
 * below the threshold, or between multiples of it).
 */
export function lockoutMinutesFor(failedLoginCount: number): number | null {
  if (failedLoginCount < LOCK_THRESHOLD || failedLoginCount % LOCK_THRESHOLD !== 0) {
    return null;
  }
  const escalation = failedLoginCount / LOCK_THRESHOLD;
  return Math.min(BASE_LOCKOUT_MINUTES * escalation, MAX_LOCKOUT_MINUTES);
}

export function isLocked(lockedUntil: Date | null): boolean {
  return !!lockedUntil && lockedUntil.getTime() > Date.now();
}

export function minutesRemaining(lockedUntil: Date): number {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60_000));
}
