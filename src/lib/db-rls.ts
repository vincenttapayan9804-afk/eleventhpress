import { db } from "@/lib/db";
import type { SessionPayload } from "@/lib/auth";

// Derived from db.$transaction's own callback parameter rather than the
// base `Prisma.TransactionClient` type — `db` is a $extends()-wrapped
// client (src/lib/db.ts's field-encryption extension), whose transaction
// client type isn't structurally identical to the unextended one.
type ExtendedTransactionClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * Runs `fn` inside a transaction with `app.user_id`/`app.role` set as
 * Postgres session GUCs (via set_config(), so values are bound as query
 * parameters — never string-interpolated into SQL) for the duration of
 * that transaction only (`is_local: true`, equivalent to SET LOCAL).
 *
 * This is what the RLS policies in prisma/rls.sql actually key off of.
 * IMPORTANT: those policies only take effect once the app's runtime DB
 * connection is switched to the restricted `app_runtime` role the SQL
 * script creates — see docs/row-level-security.md. Until then, calling
 * this is harmless (it sets a session variable nothing enforces yet) and
 * changes no query results; it exists so the two are ready to activate
 * together without a second, separate app-code rollout at that time.
 */
export async function withRlsContext<T>(
  session: SessionPayload,
  fn: (tx: ExtendedTransactionClient) => Promise<T>
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${session.userId}, true), set_config('app.role', ${session.role}, true)`;
    return fn(tx);
  });
}
