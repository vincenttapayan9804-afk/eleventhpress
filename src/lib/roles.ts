/**
 * Single source of truth for role-based access constants. Previously the
 * same "SUPER_ADMIN, EDITOR, ASSOCIATE_EDITOR" editorial-privilege set (as
 * either a Set or a plain array) and the same 6-role full list were each
 * independently re-declared across ~14 files — a drift risk if any one
 * copy ever fell out of sync with the others.
 */

export type Role = "READER" | "AUTHOR" | "REVIEWER" | "ASSOCIATE_EDITOR" | "EDITOR" | "SUPER_ADMIN" | "EXPERT" | "TENANT_ADMIN";

// Typed as readonly string[] (not `as const` literal tuples) so callers can
// keep doing `.includes(session.role)` against a plain `string` — matching
// how every one of the ~14 call sites this replaces was already typed.
export const ALL_ROLES: readonly string[] = ["READER", "AUTHOR", "REVIEWER", "ASSOCIATE_EDITOR", "EDITOR", "SUPER_ADMIN", "EXPERT", "TENANT_ADMIN"];

/** Editorial staff: manuscript decisions, board membership, admin actions. */
export const PRIVILEGED_ROLES_LIST: readonly string[] = ["SUPER_ADMIN", "EDITOR", "ASSOCIATE_EDITOR"];
export const PRIVILEGED_ROLES = new Set<string>(PRIVILEGED_ROLES_LIST);

/**
 * Whitelabel Phase 4 — a tenant's own admin, scoped to exactly that tenant
 * (branding/domains/content/users), never platform-wide. Deliberately kept
 * OUT of PRIVILEGED_ROLES_LIST: that set gates platform-wide surfaces
 * (Invoice/AuditLog RLS policies, the global editorial queues) that a
 * single tenant's admin must never see across other tenants. Routes that
 * are legitimately tenant-scoped (content creation, tenant branding/
 * domains, this tenant's own user list) opt TENANT_ADMIN in explicitly via
 * requireTenantScope() (src/lib/tenant-auth.ts) instead.
 */
export const TENANT_SCOPED_ADMIN_ROLES: readonly string[] = ["SUPER_ADMIN", "TENANT_ADMIN"];

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

/**
 * EP University OS Phase 1 — User.academicStatus values. Deliberately NOT
 * folded into Role/ALL_ROLES: `role` gates permissions (requireRole,
 * PRIVILEGED_ROLES_LIST, TENANT_SCOPED_ADMIN_ROLES) and every one of those
 * call sites assumes `role` is a mutually exclusive editorial-permission
 * tier. academicStatus answers an orthogonal question ("is this EDITOR
 * also faculty?") and must never gate a requireRole() check — a STUDENT
 * can be an AUTHOR, a FACULTY member can be an EDITOR. Self-selectable by
 * the user via /api/auth/me, same posture as SELF_SELECTABLE_ROLES.
 */
export const ACADEMIC_STATUS_OPTIONS: readonly string[] = ["FACULTY", "STUDENT", "STAFF"];

/**
 * EP University OS Phase 3 — EthicsSubmission.submissionType values (IRB
 * protocol submissions and conflict-of-interest disclosures share one
 * model; see prisma/schema.prisma).
 */
export const ETHICS_SUBMISSION_TYPES: readonly string[] = ["IRB_PROTOCOL", "COI_DISCLOSURE"];

/** EthicsSubmission.status workflow values. */
export const ETHICS_SUBMISSION_STATUSES: readonly string[] = ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "EXPIRED"];

/**
 * No new role for ethics review. Same reasoning Phase 1 used to defer
 * DEPARTMENT_ADMIN: review authority rides on TENANT_SCOPED_ADMIN_ROLES
 * (a university's own TENANT_ADMIN, plus platform-wide SUPER_ADMIN) —
 * there's no existing IRB-board/COI-committee identity in this codebase to
 * gate a narrower role against yet. Revisit if a future phase needs
 * delegated review (e.g. a department-scoped IRB chair) that shouldn't
 * also get full TENANT_ADMIN's other powers (branding, domains, quotas).
 */

/** Grant.status workflow values (EP University OS Phase 4). */
export const GRANT_STATUS_OPTIONS: readonly string[] = ["ACTIVE", "COMPLETED", "CLOSED"];

/**
 * No new role for grant/funder management, same reasoning as ethics review
 * above: Funder/Grant CRUD rides on TENANT_SCOPED_ADMIN_ROLES (a
 * university's own research/grants office is presumed to be run by its
 * TENANT_ADMIN until a narrower "grants office" identity exists to gate
 * against). Grant.principalInvestigatorUserId is a display/attribution
 * pointer only — same posture as Department.headUserId — and grants no
 * permission of its own.
 */
