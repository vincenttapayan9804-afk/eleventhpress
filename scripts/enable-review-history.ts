/**
 * One-off backfill: Article.anonymizedReviewHistory now defaults to true
 * (prisma/schema.prisma) so the transparent Review History tab is
 * automatically, permanently enabled for every article platform-wide —
 * no editor has to visit the toggle in the Editorial queue dashboard
 * per article anymore.
 *
 * A Postgres column default change only applies to new inserts going
 * forward; it never rewrites rows that already exist. This script is the
 * one-time catch-up for every article created before the default
 * changed. Idempotent — once every row is already true, it's a no-op
 * UPDATE on every later run, so it's safe to chain into the build
 * pipeline (package.json's "build" script) alongside the other
 * automatic backfills (scripts/backfill-galleys.ts) rather than needing
 * a human to run it once manually.
 *
 * Usage:
 *   bun run scripts/enable-review-history.ts
 */
import { db } from "../src/lib/db";

async function main() {
  const result = await db.article.updateMany({
    where: { anonymizedReviewHistory: false },
    data: { anonymizedReviewHistory: true },
  });
  console.log(`Enabled Review History transparency on ${result.count} article(s) that predated the platform-wide default.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
