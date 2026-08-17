/**
 * Whitelabel Phase 1 — creates the platform Tenant/TenantDomain and
 * backfills every pre-existing User onto it.
 *
 * Introducing the Tenant model must not orphan anything that existed
 * before it: the original eleventhpress.org site becomes exactly one
 * `Tenant` row with `isPlatform: true`, gets a matching `TenantDomain` for
 * the current APP_HOST (src/lib/site.ts), and every User row without a
 * tenantId is pointed at it. Idempotent — safe to run on every build
 * (same precedent as scripts/backfill-provenance.ts and friends, chained
 * in package.json's "build" script), no-ops once nothing is missing.
 *
 * Usage:
 *   bun run scripts/backfill-platform-tenant.ts             # dry run
 *   bun run scripts/backfill-platform-tenant.ts --confirm    # apply
 */
import { db } from "../src/lib/db";
import { APP_HOST } from "../src/lib/site";
import { getOrCreateTenantJournal } from "../src/lib/tenant";

const PLATFORM_SLUG = "eleventhpress";
const PLATFORM_NAME = "Eleventh Press";

async function main() {
  const confirm = process.argv.includes("--confirm");

  let platform = await db.tenant.findFirst({ where: { isPlatform: true } });
  const usersMissingTenant = await db.user.count({ where: { tenantId: null } });

  if (platform) {
    console.log(`Platform tenant already exists: [${platform.id}] "${platform.name}" (slug=${platform.slug}).`);
  } else {
    console.log(`No platform tenant found yet. Would create one for host "${APP_HOST}".`);
  }
  console.log(`${usersMissingTenant} user(s) missing a tenantId.`);

  if (!platform && usersMissingTenant === 0 && (await db.tenantDomain.count()) > 0) {
    console.log("\nNothing to backfill.");
    return;
  }

  if (!confirm) {
    console.log("\nDry run only — no changes made. Re-run with --confirm to apply.");
    return;
  }

  console.log("\n--confirm passed. Applying...\n");

  if (!platform) {
    platform = await db.tenant.create({
      data: { slug: PLATFORM_SLUG, name: PLATFORM_NAME, isPlatform: true, status: "ACTIVE" },
    });
    console.log(`  Created platform tenant [${platform.id}].`);
  }

  const existingDomain = await db.tenantDomain.findUnique({ where: { hostname: APP_HOST } });
  if (!existingDomain) {
    await db.tenantDomain.create({
      data: { tenantId: platform.id, hostname: APP_HOST, isPrimary: true, verified: true, verifiedAt: new Date() },
    });
    console.log(`  Registered domain "${APP_HOST}" -> platform tenant (auto-verified — it's our own domain).`);
  } else if (existingDomain.tenantId !== platform.id) {
    console.warn(
      `  WARNING: "${APP_HOST}" is already mapped to a different tenant (${existingDomain.tenantId}). Leaving as-is — resolve manually.`
    );
  } else {
    console.log(`  Domain "${APP_HOST}" already registered.`);
    // Phase 3 added a `verified` gate to tenant resolution — a pre-Phase-3
    // platform domain row predates that column and would default to
    // false, silently breaking the live site's own tenant resolution.
    // It's our own domain by construction, so backfill it verified.
    if (!existingDomain.verified) {
      await db.tenantDomain.update({
        where: { id: existingDomain.id },
        data: { verified: true, verifiedAt: new Date() },
      });
      console.log(`  Marked "${APP_HOST}" verified (Phase 3 backfill).`);
    }
  }

  const { count } = await db.user.updateMany({
    where: { tenantId: null },
    data: { tenantId: platform.id },
  });
  console.log(`  Backfilled ${count} user(s) onto the platform tenant.`);

  // Whitelabel Phase 4 — same story as User above: content models that
  // gained a tenantId column after rows already existed must be backfilled
  // onto the platform tenant, or they'd vanish from every tenant-scoped
  // catalog query (which now always filters by tenantId) the moment this
  // deploys.
  const contentBackfills: { label: string; run: () => Promise<{ count: number }> }[] = [
    { label: "book(s)", run: () => db.book.updateMany({ where: { tenantId: null }, data: { tenantId: platform.id } }) },
    { label: "magazine(s)", run: () => db.magazine.updateMany({ where: { tenantId: null }, data: { tenantId: platform.id } }) },
    { label: "podcast(s)", run: () => db.podcast.updateMany({ where: { tenantId: null }, data: { tenantId: platform.id } }) },
    { label: "media post(s)", run: () => db.mediaPost.updateMany({ where: { tenantId: null }, data: { tenantId: platform.id } }) },
    { label: "collection(s)", run: () => db.collection.updateMany({ where: { tenantId: null }, data: { tenantId: platform.id } }) },
  ];
  for (const { label, run } of contentBackfills) {
    const { count } = await run();
    if (count > 0) console.log(`  Backfilled ${count} ${label} onto the platform tenant.`);
  }

  // Whitelabel Phase 5 — pre-Phase-5 Journal rows (there's normally exactly
  // one) predate Journal.tenantId and belong to the platform tenant by
  // construction. Then every tenant, platform included, must end up with
  // at least one Journal — getOrCreateTenantJournal is idempotent, so this
  // is also what provisions Journals for any tenant created before Phase 5
  // shipped (new tenants get one automatically at creation time now).
  const { count: journalCount } = await db.journal.updateMany({
    where: { tenantId: null },
    data: { tenantId: platform.id },
  });
  if (journalCount > 0) console.log(`  Backfilled ${journalCount} journal(s) onto the platform tenant.`);

  const allTenants = await db.tenant.findMany({ select: { id: true, name: true } });
  for (const t of allTenants) {
    const journal = await getOrCreateTenantJournal(t);
    if (journal.createdAt.getTime() > Date.now() - 5000) {
      console.log(`  Provisioned a default journal for tenant "${t.name}" [${t.id}].`);
    }
  }

  console.log("\nDone.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
