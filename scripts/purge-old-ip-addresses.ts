/**
 * IP-address retention limit for CounterEvent (src/lib/account-privacy.ts /
 * the Privacy page both promise raw IPs are cleared after 90 days). IPs are
 * recorded at write time purely to attribute a usage event to a subscribing
 * institution (src/lib/institutions.ts's matchInstitutionByIp) — once that
 * attribution has happened (institutionId is set, or the event is old
 * enough that no institution will ever retroactively claim it), the raw IP
 * itself serves no further purpose.
 *
 * Idempotent — nulls ipAddress on any CounterEvent older than the
 * retention window; once a row's ipAddress is already null it's a no-op on
 * every later run. Runs unattended on every production build
 * (package.json's "build" script), same precedent as
 * scripts/backfill-galleys.ts and scripts/refresh-citation-metrics.ts.
 *
 * Usage:
 *   bun run scripts/purge-old-ip-addresses.ts
 */
import { db } from "../src/lib/db";

const RETENTION_DAYS = 90;

async function main() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await db.counterEvent.updateMany({
    where: { createdAt: { lt: cutoff }, ipAddress: { not: null } },
    data: { ipAddress: null },
  });
  console.log(`Purged IP addresses on ${result.count} CounterEvent row(s) older than ${RETENTION_DAYS} days.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
