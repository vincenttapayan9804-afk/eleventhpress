import type { Metadata } from "next";
import { headers } from "next/headers";
import { SpaShell } from "@/components/spa-shell";
import { requestBaseUrl, resolveTenantFromHeaders } from "@/lib/tenant";
import { publisherIdentityForTenantId } from "@/lib/publisher-identity";
import { policySignals } from "@/lib/policy-signals";

async function context() {
  const tenant = await resolveTenantFromHeaders(await headers()).catch(() => null);
  const base = await requestBaseUrl(tenant).catch(() => null);
  return { tenant, base: base || "" };
}

export async function generateMetadata(): Promise<Metadata> {
  const { base } = await context();
  return base ? { alternates: { canonical: `${base}/` }, openGraph: { url: `${base}/` } } : {};
}

/**
 * Structured data for the home page: who publishes the site (Organization),
 * the site itself (WebSite) and the journal (Periodical, with its ISSN).
 * This is what search engines use for the brand's knowledge panel and the
 * site name shown above results.
 */
async function homeJsonLd(): Promise<string | null> {
  const { tenant, base } = await context();
  if (!base) return null;
  const id = await publisherIdentityForTenantId(tenant?.id).catch(() => null);
  if (!id) return null;
  // Every form of the name people search for — with and without the ™,
  // and the short name — so search and AI answer engines tie them all to
  // this organization.
  const plain = id.publisher.replace(/[\u2122\u00ae]/g, "").trim();
  const alternateNames = [...new Set([plain, id.shortName].filter((n) => n && n !== id.publisher))];
  // Official profiles elsewhere (Branding → social links): the strongest
  // signal that this site *is* the organization of that name.
  const sameAs = Object.values(tenant?.socialLinks ?? {}).filter((u): u is string => typeof u === "string" && /^https:\/\//.test(u));
  const org: Record<string, unknown> = {
    "@type": ["Organization", "NewsMediaOrganization"],
    "@id": `${base}/#organization`,
    ...policySignals(base),
    name: id.publisher,
    alternateName: alternateNames.length > 1 ? alternateNames : alternateNames[0],
    ...(tenant?.tagline ? { slogan: tenant.tagline, description: `${plain}: ${tenant.tagline}.` } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    url: `${base}/`,
    logo: id.logoUrl ? { "@type": "ImageObject", url: new URL(id.logoUrl, base).toString() } : `${base}/logo.svg`,
    email: id.email || undefined,
    address: id.location || undefined,
  };
  const issn = [id.issn, id.eissn].filter(Boolean) as string[];
  const graph = [
    org,
    {
      "@type": "WebSite",
      "@id": `${base}/#website`,
      url: `${base}/`,
      name: id.publisher,
      ...(alternateNames.length ? { alternateName: alternateNames.length > 1 ? alternateNames : alternateNames[0] } : {}),
      inLanguage: "en",
      publisher: { "@id": `${base}/#organization` },
    },
    {
      "@type": "Periodical",
      "@id": `${base}/#journal`,
      name: id.journalName,
      url: `${base}/articles`,
      ...(issn.length ? { issn: issn.length === 1 ? issn[0] : issn } : {}),
      isAccessibleForFree: true,
      license: "https://creativecommons.org/licenses/by/4.0/",
      publisher: { "@id": `${base}/#organization` },
    },
  ];
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
}

export default async function Page() {
  const jsonLd = await homeJsonLd().catch(() => null);
  return (
    <>
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} /> : null}
      <SpaShell />
    </>
  );
}
