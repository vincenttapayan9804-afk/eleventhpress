# EP University OS — Phase 3: Ethics / IRB / COI Tracking

Ethics and compliance tracking for university tenants: IRB (Institutional
Review Board) protocol submissions and conflict-of-interest disclosures.
Built on Phase 1's org structure (`Department`) and Whitelabel's tenant
foundation, same additive posture as every prior phase — zero behavior
change for a tenant that never files a submission.

## What shipped

- **`EthicsSubmission`** (`prisma/schema.prisma`) — one model covers both
  kinds of filing (`submissionType`: `IRB_PROTOCOL` | `COI_DISCLOSURE`),
  the same way `RoleApplication` covers `REVIEWER`/`EDITOR`/`EXPERT_*`
  applications with a single discriminator rather than one model per kind.
  Direct `tenantId` column (not derived through `Article`/`Department`,
  both of which are optional on it) so it drops straight into
  `prisma/rls.sql`'s tenant-scoped `FOREACH` loop, the same reasoning
  `Department` itself used in Phase 1. Optionally scoped to a
  `departmentId` and/or `articleId`; always tied to the filer
  (`submittedByUserId`) and, once decided, the reviewer
  (`reviewedByUserId`). Workflow: `SUBMITTED` → `UNDER_REVIEW` →
  `APPROVED`/`REJECTED`, plus `EXPIRED` for a lapsed IRB approval.
  `protocolNumber` is reviewer-assigned on approval (auto-generated if
  omitted), never submitter-set.
- **Self-service API** — `POST`/`GET /api/ethics-submissions`: any
  authenticated session can file a submission and list only their own,
  mirroring how `/api/applications` scopes a non-`SUPER_ADMIN` session to
  `userId: session.userId`. A reviewer files a COI disclosure the same way
  a researcher files an IRB protocol — neither needs an editorial role
  beyond simply being authenticated with tenant context.
- **Admin review API** — `GET /api/admin/ethics-submissions` (tenant-wide
  queue, `TENANT_SCOPED_ADMIN_ROLES`, same shape as
  `GET /api/admin/departments`) and
  `POST /api/admin/ethics-submissions/[id]/review` (decision endpoint:
  `status`, optional `reviewNote`/`protocolNumber`/`expiresAt`), gated by
  `requireTenantScope` against the submission's own `tenantId` and writing
  an `AuditLog` row on every decision — mirrors
  `/api/admin/users/[id]/department` exactly.
- **Dashboard UI** — an `Ethics & COI` tab
  (`src/components/dashboard/ethics-tab.tsx`, visible to
  `AUTHOR`/`EXPERT`/`REVIEWER`/`EDITOR`/`ASSOCIATE_EDITOR`/
  `SUPER_ADMIN`/`TENANT_ADMIN`) for filing and tracking a caller's own
  submissions, and an `Ethics review` tab
  (`src/components/dashboard/ethics-review-tab.tsx`, `SUPER_ADMIN`/
  `TENANT_ADMIN` only) with an approve/reject/mark-under-review queue.
- **RLS** — `EthicsSubmission` joined `prisma/rls.sql`'s tenant-scoped
  `FOREACH` loop from its first commit, not retrofitted later; both its
  read paths are wrapped in `withTenantRlsContext`/`withRlsContext` from
  day one. See `docs/row-level-security.md`.

## Why one model instead of separate `IrbProtocol`/`CoiDisclosure` models

Both are the same shape — a title, an optional description, a submitter, a
reviewer, a status workflow, an optional department/article scope — and
splitting them would have meant duplicating every route, RLS policy, and
UI list twice for no behavioral difference. `submissionType` discriminates
where the two genuinely diverge: `protocolNumber`/`expiresAt` are
meaningful for an approved `IRB_PROTOCOL` and typically unused for a
`COI_DISCLOSURE` (a point-in-time statement, not a time-bounded approval).
If a future phase needs IRB-specific structured fields (approved subject
count, funding source, renewal cadence) that don't apply to COI at all,
splitting them apart then is a normal migration — nothing here forecloses
it.

## Why there's no `ETHICS_REVIEWER`/IRB-board role yet

Same reasoning Phase 1 used to defer `DEPARTMENT_ADMIN`: review authority
rides on `TENANT_SCOPED_ADMIN_ROLES` (a university's own `TENANT_ADMIN`,
plus platform-wide `SUPER_ADMIN`) because there's no existing IRB-board/
COI-committee identity in this codebase to gate a narrower role against
yet, and introducing one now would mean deciding its position relative to
`PRIVILEGED_ROLES_LIST`/`TENANT_SCOPED_ADMIN_ROLES` and building a
`requireDepartmentScope()`-equivalent for a single action that doesn't
need it. Revisit if a future need arises for delegated review (e.g. a
department-scoped IRB chair) that shouldn't also inherit `TENANT_ADMIN`'s
other powers (branding, domains, quotas, user management).

## Zero-backfill story

`EthicsSubmission` is a wholly new table with no pre-existing rows to
reconcile — there is nothing to backfill. A tenant that never files a
submission sees an empty queue and nothing else changes.

## Explicit non-goals (Phase 3)

- Animal-subjects/biosafety-specific submission types — `IRB_PROTOCOL`
  covers the general IRB case; a narrower taxonomy is deferred until a
  concrete need appears.
- Renewal/continuing-review workflows — `expiresAt` exists but nothing
  automatically transitions a submission to `EXPIRED` or reminds a filer
  to renew.
- Document/file attachments on a submission (consent forms, protocol
  PDFs) — no upload surface was added.
- Department-scoped review delegation (see the role section above).
- Linking a submission's approval status into the article-submission or
  PUBLISH workflow (e.g. blocking publication on a missing/expired IRB
  approval) — `articleId` is a free-form optional link only, not an
  enforced gate.
- Grant/funder intelligence, institutional rankings, comparative research
  dashboards, impact analytics — future phases, zero schema/route surface
  added for them here.
