import type { Metadata } from "next";
import { db } from "@/lib/db";
import { lockssPermissionStatementText } from "@/lib/preservation";
import { APP_BASE_URL } from "@/lib/site";
import { getCurrentTenant } from "@/lib/tenant";
import { publisherIdentityForTenantId } from "@/lib/publisher-identity";

/**
 * GET /preservation-manifest — a real, public, server-rendered page (not
 * part of the client-side SPA shell) publishing the LOCKSS/CLOCKSS crawl
 * permission statement plus links to this platform's other harvestable
 * feeds (OAI-PMH, sitemap). This is a genuine artifact a LOCKSS-technology
 * crawler or a library's preservation review can act on today, independent
 * of whether a formal CLOCKSS/Portico agreement has been signed yet — see
 * src/lib/preservation.ts's docstring for why there's no live API this
 * page could poll instead.
 */
/**
 * The visiting site's journal identity: a whitelabel tenant's own journal,
 * name and ISSN (never Eleventh Press's), else the platform journal.
 */
async function journalInfoForRequest() {
  const tenant = await getCurrentTenant().catch(() => null);
  if (tenant && !tenant.isPlatform) {
    const id = await publisherIdentityForTenantId(tenant.id);
    return { name: id.journalName, issn: id.issn, publisher: id.publisher };
  }
  const journal =
    (await db.journal.findFirst({ where: { tenantId: null } }).catch(() => null)) ??
    (await db.journal.findFirst().catch(() => null));
  return {
    name: journal?.name ?? "Eleventh Press International Publishing",
    issn: journal?.issn ?? null,
    publisher: journal?.publisher ?? "Eleventh Press International Publishing",
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const j = await journalInfoForRequest();
  return {
    title: `Preservation & Archiving — ${j.publisher}`,
    description: `LOCKSS/CLOCKSS crawl permission statement and preservation-relevant feeds for ${j.publisher}.`,
  };
}

// Queries the Journal table on every request — no DB is reachable at
// build time in this environment (same reasoning as src/app/sitemap.ts),
// and the content should reflect live journal metadata anyway.
export const dynamic = "force-dynamic";

export default async function PreservationManifestPage() {
  const journalInfo = await journalInfoForRequest();
  const permissionStatement = lockssPermissionStatementText(journalInfo);

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="eyebrow">Preservation &amp; archiving</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">{journalInfo.name}</h1>
      {journalInfo.issn && <p className="mt-1 text-sm text-muted-foreground">ISSN {journalInfo.issn}</p>}

      <section className="mt-8 rounded-md border border-border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">LOCKSS permission statement</h2>
        <p className="mt-2 text-sm leading-relaxed text-foreground/85">{permissionStatement}</p>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-lg font-semibold">Harvestable feeds</h2>
        <ul className="mt-2 space-y-1.5 text-sm">
          <li>
            <a className="text-primary underline" href={`${APP_BASE_URL}/api/oai-pmh?verb=Identify`}>
              OAI-PMH 2.0 endpoint
            </a>
          </li>
          <li>
            <a className="text-primary underline" href={`${APP_BASE_URL}/sitemap.xml`}>
              Sitemap
            </a>
          </li>
        </ul>
      </section>

      <p className="mt-8 text-xs text-muted-foreground">
        Every article published here is genuinely open access (CC BY 4.0), with no login wall on the
        full text — the actual requirement any preservation crawler needs met to archive it.
      </p>
    </main>
  );
}
