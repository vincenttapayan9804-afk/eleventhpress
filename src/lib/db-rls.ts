import { db } from "@/lib/db";
import type { SessionPayload } from "@/lib/auth";

// Derived from db.$transaction's own callback parameter rather than the
// base `Prisma.TransactionClient` type — `db` is a $extends()-wrapped
// client (src/lib/db.ts's field-encryption extension), whose transaction
// client type isn't structurally identical to the unextended one.
export type ExtendedTransactionClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * Runs `fn` inside a transaction with `app.user_id`/`app.role`/`app.tenant_id`
 * set as Postgres session GUCs (via set_config(), so values are bound as
 * query parameters — never string-interpolated into SQL) for the duration
 * of that transaction only (`is_local: true`, equivalent to SET LOCAL).
 *
 * This is what the RLS policies in prisma/rls.sql actually key off of.
 * IMPORTANT: those policies only take effect once the app's runtime DB
 * connection is switched to the restricted `app_runtime` role the SQL
 * script creates — see docs/row-level-security.md. Until then, calling
 * this is harmless (it sets a session variable nothing enforces yet) and
 * changes no query results; it exists so the two are ready to activate
 * together without a second, separate app-code rollout at that time.
 *
 * `app.tenant_id` (Whitelabel Phase 5) is set to the empty string for a
 * session with no tenantId (pre-Phase-1 tokens) rather than omitted —
 * set_config always needs a string, and an empty string can never equal a
 * real cuid, so it fails every tenant-scoped policy's row match exactly
 * like a missing value should.
 */
export async function withRlsContext<T>(
  session: SessionPayload,
  fn: (tx: ExtendedTransactionClient) => Promise<T>
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${session.userId}, true), set_config('app.role', ${session.role}, true), set_config('app.tenant_id', ${session.tenantId ?? ""}, true)`;
    return fn(tx);
  });
}

/**
 * Tenant-only counterpart to withRlsContext, for the public/unauthenticated
 * reads on tenant-scoped content tables (Book/Magazine/Podcast/MediaPost/
 * Collection/Journal/Article — Whitelabel Phase 5's prisma/rls.sql
 * policies). A public visitor browsing a tenant's site has a resolved
 * tenant (from the Host header, see src/lib/tenant.ts) but no session —
 * withRlsContext can't be used for that path since it requires one.
 *
 * Sets `app.role` to the literal string "PUBLIC" (never a real Role value,
 * so it can never accidentally satisfy a `role = 'SUPER_ADMIN'` check) and
 * `app.tenant_id` to the resolved tenant. Same activation story as
 * withRlsContext: harmless until the app's runtime DB role is switched.
 */
export async function withTenantRlsContext<T>(
  tenantId: string | null | undefined,
  fn: (tx: ExtendedTransactionClient) => Promise<T>
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.role', 'PUBLIC', true), set_config('app.tenant_id', ${tenantId ?? ""}, true)`;
    return fn(tx);
  });
}
