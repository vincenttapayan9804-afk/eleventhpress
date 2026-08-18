# EP University OS — Phase 4: Grant / Funder Intelligence

Structured grant and funder tracking for university tenants: a curated
funder registry and grant records a research/grants office can maintain,
separate from the free-text funder statement an author attaches to an
article at submission. Same additive posture as every prior phase — zero
behavior change for a tenant that never records a grant.

## What shipped

- **`Funder`** (`prisma/schema.prisma`) — a tenant-scoped, admin-curated
  registry of funding bodies: name, optional Crossref Open Funder Registry
  ID / ROR URI, country, website. Direct `tenantId` column, same reasoning
  `Department`/`EthicsSubmission` used, so it drops straight into
  `prisma/rls.sql`'s tenant-scoped `FOREACH` loop.
- **`Grant`** — the structured record a grants office actually wants:
  title, award number, amount/currency, `status` (`ACTIVE` | `COMPLETED` |
  `CLOSED`), start/end dates, optional links to a `Funder` (or a free-text
  `funderNameFreeText` fallback when the funder isn't registered yet), a
  principal investigator (`User`), a `Department`, and the `Article` it
  produced, if any. All links optional — a grant may be recorded before a
  PI, department, or output exists.
- **Admin API** — `GET`/`POST /api/admin/funders`,
  `PATCH`/`DELETE /api/admin/funders/[id]`, `GET`/`POST /api/admin/grants`,
  `PATCH`/`DELETE /api/admin/grants/[id]` — same `TENANT_SCOPED_ADMIN_ROLES`
  + tenant-confinement shape as `/api/admin/departments`. Deleting a funder
  with grants recorded against it is blocked with a structured `blockers`
  response, same convention as Department's member/child-count guard.
- **Self-service read-only API** — `GET /api/grants`: any authenticated
  session sees only the grants where they're the recorded principal
  investigator. Unlike ethics submissions, there is no self-service
  *creation* endpoint — a researcher doesn't file their own grant record,
  a grants office does; this mirrors how `Department.headUserId` is
  assigned by an admin, not claimed by the head.
- **Dashboard UI** — a `Grants` tab
  (`src/components/dashboard/grants-tab.tsx`, `SUPER_ADMIN`/
  `TENANT_ADMIN` only) combining funder-registry management with grant
  create/status-update/delete, and a `My grants` tab
  (`src/components/dashboard/my-grants-tab.tsx`, visible to
  `AUTHOR`/`EXPERT`/`REVIEWER`/`EDITOR`/`ASSOCIATE_EDITOR`/`SUPER_ADMIN`/
  `TENANT_ADMIN`) — a read-only list of the caller's own grants.
- **RLS** — `Funder` and `Grant` joined `prisma/rls.sql`'s tenant-scoped
  `FOREACH` loop from their first commit. All three read paths
  (`GET /api/admin/funders`, `GET /api/admin/grants`, `GET /api/grants`)
  are wrapped in `withRlsContext`/`withTenantRlsContext` from day one. See
  `docs/row-level-security.md`.

## Why `Article.funders` is untouched

The roadmap in `docs/university-os-phase1.md` described this phase as
"structured `Grant`/`Funder` models replacing today's free-text
`Article.funders` JSON blob." In practice, `Article.funders` is a live,
working field: captured on the submission form
(`author-submit-tab.tsx`), deposited to Crossref's FundRef extension on
publish (`src/lib/crossref.ts`'s `buildFundRefXml`). Rewriting that deposit
path to source from `Grant` records would mean either forcing every author
to link a pre-registered `Grant` before submitting — a workflow change well
beyond this phase's scope — or building a reconciliation layer between the
two, which is speculative until there's a real need to unify them. Phase 4
instead adds the institutional side (what a grants office tracks) as a new,
independent surface. `Grant.articleId` is a free-form optional pointer for
when a grants office wants to record which article a grant produced; it
does not feed back into Crossref deposit or replace the submission-time
funder statement. Unifying the two — e.g. suggesting a registered `Grant`
while filling out the funders section of the submit form — is a reasonable
future increment, not built here.

## Why there's no `GRANT_ADMIN`/grants-office role yet

Same reasoning Phase 1 used to defer `DEPARTMENT_ADMIN` and Phase 3 used to
defer an ethics-review role: `Funder`/`Grant` CRUD rides on
`TENANT_SCOPED_ADMIN_ROLES` because there's no existing grants-office
identity in this codebase to gate a narrower role against yet.
`Grant.principalInvestigatorUserId` is a display/attribution pointer only
— same posture as `Department.headUserId` — and grants no permission of
its own; a PI cannot edit their own grant record. Revisit if a future need
arises for delegated grants management that shouldn't also inherit
`TENANT_ADMIN`'s other powers.

## Zero-backfill story

`Funder` and `Grant` are wholly new tables with no pre-existing rows to
reconcile — there is nothing to backfill. A tenant that never records a
grant sees an empty registry and queue and nothing else changes.

## Explicit non-goals (Phase 4)

- Migrating `Article.funders`' Crossref FundRef deposit to source from
  `Grant` records — see the section above.
- A self-service "claim this grant" or PI-editable grant flow — grant
  records stay admin/grants-office-authored.
- Budget line-item tracking, expenditure reporting, or effort
  certification — `Grant.amount` is a single top-line figure, not a
  ledger.
- Multi-funder or multi-article grants (a many-to-many) — `Grant` links to
  at most one `Funder` and at most one `Article`. If a real need for
  either surfaces, that's a normal follow-up migration.
- Institutional rankings, comparative research dashboards, impact
  analytics — the next phase, zero schema/route surface added for it here.
