import { NextRequest, NextResponse } from "next/server";
import { resolveTenantFromHeaders, tenantBaseUrl, tenantCacheControl } from "@/lib/tenant";
import { getAuthorProfile, IDENTITY_LABEL } from "@/lib/author-profile";
import { displayCase } from "@/lib/author-path";
import { articlePath } from "@/lib/spa-routes";

/**
 * GET /api/authors/[slug] — the machine-readable verification record behind
 * a public author profile (/authors/[slug]): identity level, identifiers,
 * and every publication with the links a third party (a hiring committee,
 * an indexer, a CV checker) can follow to verify it independently — the
 * provenance verification page, the DOI, and any certificate. Public data
 * only: never a login email or anything the author keeps private.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await resolveTenantFromHeaders(req.headers).catch(() => null);
  const [p, base] = await Promise.all([getAuthorProfile(slug, tenant?.id ?? null), tenantBaseUrl(tenant?.id ?? null)]);
  if (!p) return NextResponse.json({ error: "Author not found" }, { status: 404 });
  const v = p.verification;
  const body = {
    schema: "eleventhpress.author-record/1",
    profile: `${base}/authors/${encodeURIComponent(p.slug)}`,
    id: p.slug,
    name: displayCase(p.name),
    profession: displayCase(p.profession) || null,
    affiliation: p.affiliation || null,
    country: p.country,
    orcid: p.orcid ? { id: p.orcid, url: `https://orcid.org/${p.orcid}`, authenticated: v.orcidAuthenticated } : null,
    identity: { level: v.identity, label: IDENTITY_LABEL[v.identity].badge, detail: IDENTITY_LABEL[v.identity].detail },
    disciplines: p.disciplines,
    topics: p.topics,
    metrics: { source: p.metrics.source, citations: p.metrics.citedBy, hIndex: p.metrics.hIndex, i10Index: p.metrics.i10Index, views: p.totals.views, downloads: p.totals.downloads },
    checks: v.checks,
    publications: p.articles.map((a) => ({
      id: a.id,
      title: a.title,
      type: a.contentType,
      journal: a.journal,
      issue: a.issue,
      published: a.publishedAt ? a.publishedAt.toISOString().slice(0, 10) : null,
      doi: a.doi ? { id: a.doi, url: `https://doi.org/${a.doi}` } : null,
      url: `${base}${articlePath(a.id, a.title)}`,
      provenance: a.sealed ? { sealed: true, verify: `${base}/verify/article/${a.id}` } : { sealed: false },
      authorship: a.authorship,
      editorialNotice: a.integrity,
    })),
    certificates: v.certificates.map((c) => ({ ...c, issuedAt: c.issuedAt.toISOString(), verify: `${base}/verify/${encodeURIComponent(c.serialNumber)}` })),
    checkedAt: v.checkedAt.toISOString(),
  };
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": tenantCacheControl(req, tenant, "public, s-maxage=60, stale-while-revalidate=300"),
      "Access-Control-Allow-Origin": "*",
    },
  });
}
