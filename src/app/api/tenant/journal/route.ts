import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { JOURNAL_SELECT, publisherIdentityOf } from "@/lib/publisher-identity";

/**
 * GET /api/tenant/journal
 * Public — the requesting whitelabel tenant's journal details as set on its
 * Branding tab (title, publisher, ISSNs, description, aims & scope), for
 * its About page. Returns { journal: null } on the official site, whose
 * journal identity is fixed copy.
 */
export async function GET(req: NextRequest) {
  const tenant = await resolveTenantFromHeaders(req.headers);
  if (!tenant || tenant.isPlatform) {
    return NextResponse.json({ journal: null }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const row = await db.journal
    .findFirst({ where: { tenantId: tenant.id }, select: { ...JOURNAL_SELECT, description: true, aimsScope: true } })
    .catch(() => null);
  const full = await db.tenant.findUnique({ where: { id: tenant.id } }).catch(() => null);
  const id = publisherIdentityOf(full ?? tenant, row);
  return NextResponse.json(
    {
      journal: {
        name: id.journalName,
        publisher: id.publisher,
        abbreviation: id.abbreviation,
        issn: id.issn,
        eissn: id.eissn,
        description: row?.description?.trim() || null,
        aimsScope: row?.aimsScope?.trim() || null,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
