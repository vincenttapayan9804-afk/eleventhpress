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
      data: { tenantId: platform.id, hostname: APP_HOST, isPrimary: true },
    });
    console.log(`  Registered domain "${APP_HOST}" -> platform tenant.`);
  } else if (existingDomain.tenantId !== platform.id) {
    console.warn(
      `  WARNING: "${APP_HOST}" is already mapped to a different tenant (${existingDomain.tenantId}). Leaving as-is — resolve manually.`
    );
  } else {
    console.log(`  Domain "${APP_HOST}" already registered.`);
  }

  const { count } = await db.user.updateMany({
    where: { tenantId: null },
    data: { tenantId: platform.id },
  });
  console.log(`  Backfilled ${count} user(s) onto the platform tenant.`);

  console.log("\nDone.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
