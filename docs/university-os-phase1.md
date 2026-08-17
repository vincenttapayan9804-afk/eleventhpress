# EP University OS — Phase 1: Org Structure & Roles

The foundation layer for "EP University OS": giving university tenants a
departmental org structure and a student/faculty academic identity. Built
additively on top of the whitelabel multi-tenant foundation (Phases 1-8),
same posture as every one of those phases — nullable, zero behavior change
for the existing site until a tenant actually adopts it.

## What shipped

- **`Department`** (`prisma/schema.prisma`) — a tenant-scoped org/roster
  grouping: `name`, `slug` (unique per tenant), an optional `headUserId`
  (display/attribution pointer, not a permission grant), and an optional
  `parentDepartmentId` (unused by any Phase 1 code path — included now so a
  future School > Department hierarchy doesn't need a second migration).
- **`User.departmentId` / `User.academicStatus`** — both nullable, both
  `null` for every pre-existing row. `academicStatus` is `FACULTY`,
  `STUDENT`, or `STAFF` (`ACADEMIC_STATUS_OPTIONS` in `src/lib/roles.ts`).
- **Admin API** — `GET`/`POST /api/admin/departments`,
  `PATCH`/`DELETE /api/admin/departments/[id]`, gated by
  `requireTenantScope` + `TENANT_SCOPED_ADMIN_ROLES` (`SUPER_ADMIN`,
  `TENANT_ADMIN`): a university's own `TENANT_ADMIN` manages its
  departments without platform involvement. `DELETE` blocks with a
  structured `blockers` response (members/child departments) rather than
  surfacing a raw FK error.
- **Admin override** — `POST /api/admin/users/[id]/department`, mirroring
  the existing role-change route exactly (same tenant confinement, same
  `AuditLog` write on change).
- **Self-service** — `PATCH /api/auth/me` now accepts `academicStatus` and
  `departmentId`; `GET /api/departments` is a lightweight, non-admin
  listing (any authenticated session, scoped to `session.tenantId`) so
  every role can populate its own department picker.
- **Dashboard UI** — a `Departments` tab (`src/components/dashboard/departments-tab.tsx`,
  visible to `SUPER_ADMIN`/`TENANT_ADMIN`) for department CRUD, and an
  "Academic details" card on the self-service profile tab
  (`src/components/dashboard/profile-tab.tsx`) for academic status +
  department selection — shown only when the caller's tenant actually has
  departments to choose from.
- **RLS** — `Department` was added straight into `prisma/rls.sql`'s
  existing tenant-scoped `FOREACH` loop (see `docs/row-level-security.md`)
  from its first commit, not retrofitted later; its one read path is
  wrapped in `withRlsContext`/`withTenantRlsContext` from day one.

## Why `academicStatus` is separate from `role`

`role` (`src/lib/roles.ts`) gates permissions — `requireRole()`,
`PRIVILEGED_ROLES_LIST`, `TENANT_SCOPED_ADMIN_ROLES` all assume it's a
mutually exclusive editorial-permission tier, and roughly a dozen call
sites depend on that. `academicStatus` answers an orthogonal question —
"is this `EDITOR` also faculty?" — a `STUDENT` can be an `AUTHOR`, a
`FACULTY` member can be an `EDITOR`. Folding `FACULTY`/`STUDENT`/`STAFF`
into `Role`/`ALL_ROLES` would have broken that mutual-exclusivity
assumption everywhere it's checked. `ACADEMIC_STATUS_OPTIONS` is its own,
deliberately separate list.

## Why there's no `DEPARTMENT_ADMIN` role yet

`headUserId` is a display/attribution pointer only — it grants no
permission. Introducing a department-scoped admin role now would mean
adding it to `Role`/`ALL_ROLES`, deciding its position relative to
`PRIVILEGED_ROLES_LIST`/`TENANT_SCOPED_ADMIN_ROLES`, and building a
`requireDepartmentScope()` — none of which Phase 1 has any protected
action to gate (department CRUD is `TENANT_ADMIN`/`SUPER_ADMIN`-only; there
is no department-scoped write surface yet). This mirrors how `TENANT_ADMIN`
itself was deferred to Whitelabel Phase 4 rather than shipped alongside
`Tenant`/`TenantDomain` in Whitelabel Phase 1. Revisit when a future phase
(most likely Phase 3, ethics/IRB tracking) first needs a
department-scoped write action.

## Zero-backfill story

Unlike `Tenant`/`TenantDomain` (Whitelabel Phase 1), which required every
pre-existing `User` to be backfilled onto the platform tenant so nothing
became tenant-less, `Department`/`User.departmentId`/`User.academicStatus`
have no such invariant: `null` is a fully valid, permanent steady state for
every non-university tenant and every user who simply isn't
faculty/student. No backfill script was needed.

## Explicit non-goals (Phase 1)

- Department branding (logo/colors) — no such fields exist.
- Department sub-domains/sub-sites — `Department` has no `TenantDomain`-equivalent.
- A `DEPARTMENT_ADMIN` role/permission tier (see above).
- Ethics/IRB/COI tracking, grant/funder intelligence, institutional
  rankings, comparative research dashboards, impact analytics — all future
  phases, zero schema/route surface added for them here.
- Department-scoped `Journal`/`Article` ownership — a `Department` is an
  org/roster concept only; it does not own or scope any editorial content.
- `parentDepartmentId` hierarchy enforcement — the field exists to avoid a
  future migration, but no route/UI enforces or displays a hierarchy yet.

## Roadmap (not built yet)

Phase 2 would likely enrich researcher/faculty profiles (surfacing
`academicStatus`/`departmentId` on the public author directory,
`src/app/api/authors/route.ts`) and add department landing pages. Phase 3
would add ethics/IRB/COI tracking (a new department-scoped model). Phase 4
would add grant/funder intelligence, replacing today's free-text
`Article.funders` JSON blob with structured `Grant`/`Funder` models. Phase 5
would add institutional rankings and cross-institution comparative
analytics, building on the existing COUNTER/SUSHI infrastructure
(`src/lib/counter.ts`).
