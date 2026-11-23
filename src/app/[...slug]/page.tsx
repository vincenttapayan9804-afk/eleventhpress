import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { SpaShell } from "@/components/spa-shell";
import { stateForPath, viewDescription, VIEW_META } from "@/lib/spa-routes";
import { getCurrentTenant } from "@/lib/tenant";
import { APP_BASE_URL } from "@/lib/site";
import { SHARE_IMAGES } from "@/lib/share-image";
import { PLATFORM_FAQS } from "@/lib/faqs";
import { getOpenEditionIssue, openEditionCopyright } from "@/lib/open-edition";

/**
 * Every page of the single-page site other than "/" — /articles, /about,
 * /dashboard/profile, /magazines/<id> and so on (src/lib/spa-routes.ts).
 * Renders the same SpaShell as "/", opened on the view the URL names, so
 * direct visits, refreshes and shared links land on the right page.
 * Anything that isn't one of those paths is a real 404.
 */

type Props = {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pathOf(slug: string[]) {
  return "/" + slug.map((s) => {
    try {
      return encodeURIComponent(decodeURIComponent(s));
    } catch {
      return encodeURIComponent(s);
    }
  }).join("/");
}

function searchOf(sp: Record<string, string | string[] | undefined>) {
  const tab = sp.tab;
  return typeof tab === "string" ? `?tab=${encodeURIComponent(tab)}` : "";
}

export async function generateMetadata({ params }: Props, parent: ResolvingMetadata): Promise<Metadata> {
  const { slug } = await params;
  const route = stateForPath(pathOf(slug));
  if (!route) return {};
  const tenant = await getCurrentTenant().catch(() => null);
  const siteName = tenant && !tenant.isPlatform ? tenant.siteName || tenant.name : null;
  const base = (await parent).title?.absolute || siteName || "Eleventh Press International Publishing™";
  const openEdition = route.view === "magazineIssue" ? getOpenEditionIssue(route.magazineIssueId) : undefined;
  if (openEdition) {
    const title = `${openEdition.series}: ${openEdition.title} ${openEdition.titleItalic} — Magazines — ${base}`;
    const url = `${APP_BASE_URL}${pathOf(slug)}`;
    const images = [{ url: `${APP_BASE_URL}${openEdition.cover}`, alt: openEdition.coverAlt }];
    return {
      title,
      description: openEdition.description,
      alternates: { canonical: url },
      openGraph: { title, description: openEdition.description, url, type: "article", images },
      twitter: { card: "summary_large_image", title, description: openEdition.description, images },
    };
  }
  const meta = VIEW_META[route.view];
  if (!meta) return { title: base, alternates: { canonical: `${APP_BASE_URL}${pathOf(slug)}` } };
  const description = viewDescription(meta.description, siteName);
  return {
    title: `${meta.title} — ${base}`,
    description,
    alternates: { canonical: `${APP_BASE_URL}${pathOf(slug)}` },
    robots: meta.index === false ? { index: false, follow: true } : undefined,
    openGraph: { title: `${meta.title} — ${base}`, description, url: `${APP_BASE_URL}${pathOf(slug)}`, images: SHARE_IMAGES },
    twitter: { card: "summary_large_image", title: `${meta.title} — ${base}`, description, images: SHARE_IMAGES },
  };
}

/** schema.org page type for each section page (WebPage otherwise). */
const PAGE_TYPES: Partial<Record<string, string>> = {
  about: "AboutPage",
  contact: "ContactPage",
  faqs: "FAQPage",
  browse: "CollectionPage",
  books: "CollectionPage",
  collections: "CollectionPage",
  authors: "CollectionPage",
  experts: "CollectionPage",
  magazines: "CollectionPage",
  podcasts: "CollectionPage",
  media: "CollectionPage",
  departments: "CollectionPage",
  resources: "CollectionPage",
};

/**
 * Structured data for an indexable section page: what kind of page it is,
 * which site it belongs to, and a Home → page breadcrumb (shown in place of
 * the bare URL in Google and Bing results). The FAQs page also carries its
 * questions and answers as FAQPage — on the official site only, since a
 * whitelabel tenant's FAQ copy is rewritten in its own name on the client.
 */
async function sectionJsonLd(path: string, view: string): Promise<string | null> {
  const meta = VIEW_META[view as keyof typeof VIEW_META];
  if (!meta || meta.index === false) return null;
  const tenant = await getCurrentTenant().catch(() => null);
  const whitelabel = !!tenant && !tenant.isPlatform;
  const siteName = whitelabel ? tenant.siteName || tenant.name : "Eleventh Press International Publishing™";
  const url = `${APP_BASE_URL}${path}`;
  const type = PAGE_TYPES[view] ?? "WebPage";
  const page: Record<string, unknown> = {
    "@type": type === "FAQPage" && whitelabel ? "WebPage" : type,
    "@id": `${url}#webpage`,
    url,
    name: meta.title,
    description: viewDescription(meta.description, whitelabel ? siteName : null),
    inLanguage: "en",
    isPartOf: { "@type": "WebSite", "@id": `${APP_BASE_URL}/#website`, url: `${APP_BASE_URL}/`, name: siteName },
    breadcrumb: { "@id": `${url}#breadcrumb` },
  };
  if (type === "FAQPage" && !whitelabel) {
    page.mainEntity = PLATFORM_FAQS.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    }));
  }
  const breadcrumb = {
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${APP_BASE_URL}/` },
      { "@type": "ListItem", position: 2, name: meta.title, item: url },
    ],
  };
  return JSON.stringify({ "@context": "https://schema.org", "@graph": [page, breadcrumb] }).replace(/</g, "\\u003c");
}

/** schema.org PublicationIssue for an Open Edition issue, listing its articles. */
function openEditionJsonLd(issue: NonNullable<ReturnType<typeof getOpenEditionIssue>>, path: string): string {
  const url = `${APP_BASE_URL}${path}`;
  const data = {
    "@context": "https://schema.org",
    "@type": "PublicationIssue",
    "@id": `${url}#issue`,
    url,
    name: `${issue.title} ${issue.titleItalic}`,
    issueNumber: String(issue.issueNumber),
    datePublished: issue.publishedAt,
    description: issue.description,
    image: `${APP_BASE_URL}${issue.cover}`,
    isAccessibleForFree: true,
    encoding: { "@type": "MediaObject", contentUrl: `${APP_BASE_URL}${issue.pdf}`, encodingFormat: "application/pdf" },
    isPartOf: {
      "@type": "PublicationVolume",
      volumeNumber: String(issue.volume),
      isPartOf: { "@type": "Periodical", name: issue.series, publisher: { "@type": "Organization", name: "Eleventh Press International Publishing" } },
    },
    hasPart: issue.pieces.map((p) => ({
      "@type": "Article",
      headline: p.title,
      description: p.dek,
      url: `${url}#${p.slug}`,
      image: `${APP_BASE_URL}${p.image}`,
      author: p.reprint
        ? p.reprint.authors
          ? p.reprint.authors.split(/, | and /).map((name) => ({ "@type": "Person", name: name.replace(/^Dr /, "") }))
          : { "@type": "Organization", name: p.reprint.publisher }
        : { "@type": "Organization", name: "Eleventh Press Editorial Team" },
      ...(p.reprint
        ? { license: p.reprint.licence.url, isBasedOn: p.reprint.sourceUrl }
        : {
            // Originals are all rights reserved, not Creative Commons.
            copyrightHolder: { "@type": "Organization", name: "Eleventh Press International Publishing" },
            copyrightYear: issue.year,
            copyrightNotice: openEditionCopyright(issue.year),
          }),
    })),
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function SpaRoutePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const path = pathOf(slug);
  const route = stateForPath(path, searchOf(await searchParams));
  if (!route) notFound();
  // Only a section's own URL (/about, /faqs …), not deeper views like /magazines/<id>.
  const openEdition = route.view === "magazineIssue" ? getOpenEditionIssue(route.magazineIssueId) : undefined;
  const jsonLd = openEdition
    ? openEditionJsonLd(openEdition, path)
    : slug.length === 1 ? await sectionJsonLd(path, route.view).catch(() => null) : null;
  return (
    <>
      {/* A plain text child, not dangerouslySetInnerHTML: React writes <script>
          text verbatim (escaping any "</script"), and the JSON already has
          every "<" escaped as \u003c. */}
      {jsonLd ? <script type="application/ld+json">{jsonLd}</script> : null}
      <SpaShell initialRoute={route} />
    </>
  );
}
