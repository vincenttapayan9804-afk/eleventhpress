/**
 * Whitelabel Phase 7 — backfills AuditLog.tenantId on rows written before
 * that column existed. New writes never need this: db.ts's
 * `audit-log-tenant-tagging` Prisma extension derives tenantId
 * transparently at write time for every one of the ~46 call sites across
 * the app, with no code changes to any of them. This script exists only
 * for the historical rows written before that extension shipped — same
 * "idempotent, safe to chain into every build" precedent as
 * scripts/backfill-platform-tenant.ts and friends.
 *
 * Two passes, in the same priority order db.ts's resolveAuditTenantId
 * uses: articleId (via Article -> Journal.tenantId) first, then userId
 * (via User.tenantId) for whatever's left without an articleId or whose
 * article's journal predates Journal.tenantId. Rows with neither a
 * resolvable articleId nor userId (or whose target's own tenantId is
 * null) are left null — same fail-open posture as the write-time
 * extension; there's nothing to backfill onto.
 *
 * Usage:
 *   bun run scripts/backfill-audit-tenant.ts             # dry run
 *   bun run scripts/backfill-audit-tenant.ts --confirm    # apply
 */
import { db } from "../src/lib/db";

async function main() {
  const confirm = process.argv.includes("--confirm");

  const [viaArticle, viaUser] = await Promise.all([
    db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM "AuditLog" al
      JOIN "Article" a ON a.id = al."articleId"
      JOIN "Journal" j ON j.id = a."journalId"
      WHERE al."tenantId" IS NULL AND al."articleId" IS NOT NULL AND j."tenantId" IS NOT NULL
    `,
    db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM "AuditLog" al
      JOIN "User" u ON u.id = al."userId"
      WHERE al."tenantId" IS NULL
        AND NOT (al."articleId" IS NOT NULL AND EXISTS (
          SELECT 1 FROM "Article" a JOIN "Journal" j ON j.id = a."journalId"
          WHERE a.id = al."articleId" AND j."tenantId" IS NOT NULL
        ))
        AND u."tenantId" IS NOT NULL
    `,
  ]);

  const articleCount = Number(viaArticle[0]?.count ?? 0);
  const userCount = Number(viaUser[0]?.count ?? 0);

  console.log(`${articleCount} row(s) backfillable via articleId -> Journal.tenantId.`);
  console.log(`${userCount} row(s) backfillable via userId -> User.tenantId.`);

  if (articleCount === 0 && userCount === 0) {
    console.log("\nNothing to backfill.");
    return;
  }

  if (!confirm) {
    console.log("\nDry run only — no changes made. Re-run with --confirm to apply.");
    return;
  }

  console.log("\n--confirm passed. Applying...\n");

  const articleResult = await db.$executeRaw`
    UPDATE "AuditLog" al
    SET "tenantId" = j."tenantId"
    FROM "Article" a JOIN "Journal" j ON j.id = a."journalId"
    WHERE al."articleId" = a.id AND al."tenantId" IS NULL AND j."tenantId" IS NOT NULL
  `;
  console.log(`  Backfilled ${articleResult} row(s) via articleId -> Journal.tenantId.`);

  const userResult = await db.$executeRaw`
    UPDATE "AuditLog" al
    SET "tenantId" = u."tenantId"
    FROM "User" u
    WHERE al."userId" = u.id AND al."tenantId" IS NULL AND u."tenantId" IS NOT NULL
  `;
  console.log(`  Backfilled ${userResult} row(s) via userId -> User.tenantId.`);

  console.log("\nDone.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
