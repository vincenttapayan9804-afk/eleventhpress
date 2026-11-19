/**
 * Gives every whitelabel tenant its free <slug>.eleventhpress.com subdomain
 * (see ensureTenantSubdomain in src/lib/tenant-onboarding.ts). New tenants
 * get it when they're created; this catches up tenants created before
 * subdomains were switched on. Idempotent: runs on every deploy and only
 * adds what's missing.
 *
 * Usage:
 *   bun run scripts/backfill-tenant-subdomains.ts
 */
import { db } from "../src/lib/db";
import { ensureTenantSubdomain, tenantRootDomain, tenantSubdomain } from "../src/lib/tenant-onboarding";

async function main() {
  const root = tenantRootDomain();
  if (!root) {
    console.log("No tenant root domain for this deployment; skipped.");
    return;
  }
  const tenants = await db.tenant.findMany({ where: { isPlatform: false }, select: { id: true, slug: true } });
  let added = 0;
  for (const t of tenants) {
    const hostname = tenantSubdomain(t.slug);
    if (!hostname) continue;
    const had = await db.tenantDomain.findUnique({ where: { hostname }, select: { id: true } });
    if (!had && (await ensureTenantSubdomain(t))) {
      added++;
      console.log(`  ${hostname} -> ${t.slug}`);
    }
  }
  console.log(`Tenant subdomains under ${root}: ${tenants.length} tenant(s) checked, ${added} added.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
