/**
 * Single source of truth for role-based access constants. Previously the
 * same "SUPER_ADMIN, EDITOR, ASSOCIATE_EDITOR" editorial-privilege set (as
 * either a Set or a plain array) and the same 6-role full list were each
 * independently re-declared across ~14 files — a drift risk if any one
 * copy ever fell out of sync with the others.
 */

export type Role = "READER" | "AUTHOR" | "REVIEWER" | "ASSOCIATE_EDITOR" | "EDITOR" | "SUPER_ADMIN" | "EXPERT";

// Typed as readonly string[] (not `as const` literal tuples) so callers can
// keep doing `.includes(session.role)` against a plain `string` — matching
// how every one of the ~14 call sites this replaces was already typed.
export const ALL_ROLES: readonly string[] = ["READER", "AUTHOR", "REVIEWER", "ASSOCIATE_EDITOR", "EDITOR", "SUPER_ADMIN", "EXPERT"];

/** Editorial staff: manuscript decisions, board membership, admin actions. */
export const PRIVILEGED_ROLES_LIST: readonly string[] = ["SUPER_ADMIN", "EDITOR", "ASSOCIATE_EDITOR"];
export const PRIVILEGED_ROLES = new Set<string>(PRIVILEGED_ROLES_LIST);

/** Roles a user may self-select at registration without an application/review. */
export const SELF_SELECTABLE_ROLES: readonly string[] = ["READER", "AUTHOR"];

/**
 * `RoleApplication.requestedRole` values that require editorial approval.
 * Note "EXPERT" itself never appears here or as a literal requestedRole —
 * applicants request EXPERT_CONTRIBUTOR or EXPERT_COUNCIL_MEMBER (the
 * Prestige Council tiers), and approval promotes User.role to the single
 * "EXPERT" value plus sets User.expertTier accordingly (see
 * src/app/api/applications/[id]/review/route.ts). Kept in its own list
 * rather than folded into APPLICATION_ROLES since those two values are
 * never valid User.role values and would break ALL_ROLES-subset checks.
 */
export const APPLICATION_ROLES: readonly string[] = ["REVIEWER", "EDITOR"];

/** Prestige Council application tiers — requestedRole values for the
 * Experts' Insights vetting flow (Publication Charter, Prestige
 * Application Form). Contributor = one-off pieces; Council Member = a
 * vetted expert committed to recurring monthly insights. */
export const EXPERT_APPLICATION_TIERS: readonly string[] = ["EXPERT_CONTRIBUTOR", "EXPERT_COUNCIL_MEMBER"];
