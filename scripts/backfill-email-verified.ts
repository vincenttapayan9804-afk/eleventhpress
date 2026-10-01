/**
 * Email verification — grandfathers every pre-existing account onto
 * "verified as of its original registration," since enforcing a brand-new
 * requirement retroactively against users who were never asked to verify
 * would lock real, long-standing accounts out of nothing they did wrong.
 * Only accounts created AFTER this column existed (which register.ts
 * itself now sets emailVerificationToken for) stay unverified until they
 * actually click the link. Idempotent — safe to run on every build (same
 * precedent as scripts/backfill-platform-tenant.ts and friends, chained
 * in package.json's "build" script), no-ops once nothing is missing.
 *
 * Usage:
 *   bun run scripts/backfill-email-verified.ts             # dry run
 *   bun run scripts/backfill-email-verified.ts --confirm    # apply
 */
import { db } from "../src/lib/db";

async function main() {
  const confirm = process.argv.includes("--confirm");

  const unverified = await db.user.findMany({
    where: { emailVerifiedAt: null },
    select: { id: true, email: true, createdAt: true },
  });

  console.log(`${unverified.length} user(s) with no emailVerifiedAt.`);
  if (unverified.length === 0) {
    console.log("\nNothing to backfill.");
    return;
  }

  if (!confirm) {
    console.log("\nDry run only — no changes made. Re-run with --confirm to apply.");
    return;
  }

  console.log("\n--confirm passed. Applying...\n");

  for (const user of unverified) {
    await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: user.createdAt } });
  }
  console.log(`  Grandfathered ${unverified.length} pre-existing account(s) as verified (as of their own createdAt).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
