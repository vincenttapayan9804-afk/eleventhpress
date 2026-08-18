-- Row Level Security — defense-in-depth for the two tables that should
-- NEVER be readable cross-user or by the public under any circumstance:
-- Invoice (financial/payment records) and AuditLog (security/audit trail).
--
-- IMPORTANT — read before running this:
-- Postgres RLS policies are bypassed entirely by a table's OWNER and by any
-- role with the BYPASSRLS attribute (including superusers). The role this
-- app currently connects as (POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING)
-- is the same role that ran `prisma db push` and therefore OWNS these
-- tables — running this script alone, with no other change, enables RLS
-- but has ZERO enforcement effect until the app's runtime connection is
-- switched to the new, restricted `app_runtime` role this script creates.
-- See docs/row-level-security.md for the full, honest activation story —
-- this mirrors this codebase's existing LiveMode pattern (Zenodo,
-- iThenticate, rate limiting): shippable and inert until a real,
-- manual production step activates it, never silently faked as enforced.
--
-- Idempotent — safe to run more than once.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    -- NOLOGIN by default on purpose: a real password is set out-of-band by
    -- whoever runs this (ALTER ROLE app_runtime WITH LOGIN PASSWORD '...'),
    -- never hardcoded into a file that lands in version control.
    CREATE ROLE app_runtime NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;

-- The app needs full CRUD on every table to function at all — RLS below
-- narrows what app_runtime can actually SEE/affect on just the two
-- protected tables; this grant alone does not undermine that, since RLS
-- policies apply on top of (not instead of) these privileges.
GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;

-- ---------------------------------------------------------------------------
-- Invoice — a user may only ever see their own invoices; editorial/admin
-- staff (who legitimately review payment status as part of the editorial
-- workflow) see all. Mirrors the exact same allow-list src/lib/roles.ts
-- calls PRIVILEGED_ROLES.
-- ---------------------------------------------------------------------------
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoice_owner_or_privileged ON "Invoice";
CREATE POLICY invoice_owner_or_privileged ON "Invoice"
  USING (
    "userId" = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SUPER_ADMIN', 'EDITOR', 'ASSOCIATE_EDITOR')
  )
  WITH CHECK (
    "userId" = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SUPER_ADMIN', 'EDITOR', 'ASSOCIATE_EDITOR')
  );

-- ---------------------------------------------------------------------------
-- AuditLog — every authenticated action legitimately needs to INSERT a row
-- here (login events, editorial decisions, payments…) regardless of whose
-- audit trail it's attributed to, so INSERT stays unrestricted; the app
-- layer already gates who can trigger the underlying action before the log
-- write happens. What RLS adds is restricting SELECT/UPDATE/DELETE (reading
-- or tampering with the trail) to editorial/admin staff only — never a
-- plain reader/author, and never the public.
-- ---------------------------------------------------------------------------
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auditlog_insert_any ON "AuditLog";
CREATE POLICY auditlog_insert_any ON "AuditLog"
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS auditlog_read_privileged_only ON "AuditLog";
CREATE POLICY auditlog_read_privileged_only ON "AuditLog"
  FOR SELECT
  USING (current_setting('app.role', true) IN ('SUPER_ADMIN', 'EDITOR', 'ASSOCIATE_EDITOR'));

-- No UPDATE/DELETE policy is defined on purpose: with RLS enabled and no
-- policy for a given command, Postgres denies that command outright — the
-- audit trail is meant to be append-only, so this is the correct default,
-- not an oversight. This explicit no-op policy just documents that intent.
DROP POLICY IF EXISTS auditlog_immutable ON "AuditLog";
CREATE POLICY auditlog_immutable ON "AuditLog"
  FOR UPDATE
  USING (false);

-- ---------------------------------------------------------------------------
-- Whitelabel Phase 5 — tenant isolation, defense-in-depth.
--
-- The app layer already filters every read/write on these tables by the
-- current request's tenantId (Whitelabel Phases 4-5). These policies exist
-- so that a bug in that app-layer filtering — a missing `where` clause, a
-- route that forgets to resolve the tenant — fails closed at the database
-- instead of silently leaking one tenant's content to another. Same
-- inert-until-activated story as Invoice/AuditLog above: harmless today,
-- takes effect only once the app's runtime connection is switched to
-- app_runtime (docs/row-level-security.md).
--
-- SUPER_ADMIN bypasses every one of these (platform staff legitimately see
-- across all tenants); every other role/session is confined to rows whose
-- tenantId matches app.tenant_id, set per-request by withRlsContext /
-- withTenantRlsContext (src/lib/db-rls.ts). A row with tenantId IS NULL
-- (pre-backfill data, or a session with no tenant context at all) matches
-- nothing but SUPER_ADMIN — fails closed rather than open.
--
-- Whitelabel Phase 8 — SELECT-only (FOR SELECT), same convention as
-- AuditLog's auditlog_read_privileged_only policy above, not the original
-- blanket USING/WITH CHECK (which covered every command). INSERT/UPDATE/
-- DELETE on these tables stay ungated at the database layer, same as
-- AuditLog's inserts: write-side isolation is already enforced at the
-- application layer (the `where: { tenantId }` filters and
-- isSameEditorialTenant checks built across Whitelabel Phases 4-7), and
-- several write-heavy editorial routes (e.g. the article PUBLISH workflow)
-- interleave DB writes with slow external calls — Crossref/Zenodo deposits,
-- the pandoc-worker galley pipeline — that must never sit inside one
-- held DB transaction. Restricting RLS to reads keeps activation's
-- prerequisite bounded to "every SELECT touching these tables sets
-- app.tenant_id first," which is a completable, auditable bar; a
-- write-inclusive policy would require rearchitecting those pipelines
-- around single transactions purely to satisfy a defense-in-depth layer,
-- which is not a trade worth making.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  -- EP University OS Phase 1 — Department joins this convention from day
  -- one (it has a direct tenantId column, so it fits the loop verbatim)
  -- instead of being retrofitted later, the way Book/Magazine/etc. were.
  -- Phase 3 — EthicsSubmission joins the same way, for the same reason.
  FOREACH t IN ARRAY ARRAY['Book', 'Magazine', 'Podcast', 'MediaPost', 'Collection', 'Journal', 'Department', 'EthicsSubmission']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_scoped', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING ("tenantId" = current_setting(''app.tenant_id'', true) OR current_setting(''app.role'', true) = ''SUPER_ADMIN'')',
      t || '_tenant_scoped', t
    );
  END LOOP;
END
$$;

-- Article has no tenantId column of its own — it's scoped transitively
-- through its Journal (Article.journalId -> Journal.tenantId). A subquery
-- policy rather than a denormalized column, since Journal is already the
-- single source of truth for "which tenant does this article belong to."
ALTER TABLE "Article" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Article" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS article_tenant_scoped ON "Article";
CREATE POLICY article_tenant_scoped ON "Article"
  FOR SELECT
  USING (
    current_setting('app.role', true) = 'SUPER_ADMIN'
    OR EXISTS (
      SELECT 1 FROM "Journal" j
      WHERE j.id = "Article"."journalId"
        AND j."tenantId" = current_setting('app.tenant_id', true)
    )
  );
