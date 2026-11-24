import { JOURNAL_IDENTITY } from "@/lib/site";
import { CcLicenceBadge, OpenAccessIcon } from "@/components/badges/open-badges";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { articlePdfPath, scholarDate } from "@/lib/scholar-meta";
import { articleIdFromSegment, articlePath } from "@/lib/spa-routes";
import { db } from "@/lib/db";
import { parseAuthors, formatCitation } from "@/lib/article";
import { coinsSpanProps } from "@/lib/citation-export";
import { publisherIdentityForJournal } from "@/lib/publisher-identity";
import { tenantBaseUrl } from "@/lib/tenant";
import { ARTICLE_LANGUAGE } from "@/lib/site";
import { searchDescription, searchTitle } from "@/lib/seo-text";
import { displayCase } from "@/lib/author-path";
import { ARTICLE_LICENSE_URL, landingPageSignposts } from "@/lib/signposting";
import { I18nProvider } from "@/components/i18n-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/sonner";
import { ArticleRouteBootstrap } from "@/components/article-route-bootstrap";

/**
 * GET /article/[id] — the real, crawlable, directly-linkable article page.
 *
 * The rest of this app is a client-side single-page shell (src/app/page.tsx
 * switches "views" purely via zustand state, with no URL routing at all —
 * see that file's comments). That means, before this route existed,
 * *every* URL this platform hands out as an article's canonical identity —
 * DOI landing pages deposited to Zenodo, citation_abstract_html_url meta
 * tags, distribution share-kit links, OAI-PMH identifiers, sitemap
 * entries — pointed at a path with no matching Next.js route, so it 404'd
 * for anyone who followed it outside the SPA (including every indexer:
 * Google Scholar's crawler, DOI resolvers, social-share unfurlers).
 *
 * This route fixes that for the one URL shape that actually needs to be a
 * real, independently-fetchable page: generateMetadata() below renders the
 * citation and OpenGraph tags server-side (the previous approach injected
 * them via a client useEffect — invisible to any crawler that doesn't run
 * JS), and the page body renders a real, always-present bibliographic
 * snapshot before handing off to the existing rich ArticleView experience
 * once the client hydrates (see ArticleRouteBootstrap).
 */

// The URL segment is either the bare id (DOIs, feeds, provenance records,
// older links) or the readable "<title-slug>--<id>" form (spa-routes.ts).
async function findArticle(segment: string) {
  const include = { journal: true, issue: true } as const;
  const raw = decodeURIComponent(segment);
  return (
    (await db.article.findUnique({ where: { id: raw }, include })) ??
    (raw.includes("--") ? await db.article.findUnique({ where: { id: articleIdFromSegment(segment) }, include }) : null)
  );
}

async function getPublishedArticle(segment: string) {
  const article = await findArticle(segment);
  if (!article || article.status !== "PUBLISHED") return null;
  return article;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const article = await getPublishedArticle(id);
  if (!article) {
    // Not public (a draft or a manuscript under review): the page still
    // opens for a signed-in author or editor, whose session the client
    // checks, but nothing about it is rendered or indexed.
    const any = await findArticle(id);
    return any ? { title: "Article", robots: { index: false, follow: false } } : { title: "Article not found" };
  }

  const authors = parseAuthors(article.authors);
  const authorNames = authors.map((a) => a.name).filter(Boolean);
  const summary = (article.laySummary || article.abstract).slice(0, 300);
  const identity = await publisherIdentityForJournal(article.journal);
  // A tenant with its own verified domain owns its articles' canonical URL;
  // everything else stays on the platform's URL (where DOIs resolve).
  const canonicalUrl = `${await tenantBaseUrl(identity.tenantId)}${articlePath(article.id, article.title)}`;

  const other: Record<string, string | string[]> = {
    citation_title: article.title,
    citation_journal_title: article.journal?.name || identity.journalName,
    citation_publisher: identity.publisher,
    citation_abstract_html_url: canonicalUrl,
    citation_language: ARTICLE_LANGUAGE,
  };
  // Each author in its own tag, names only (no affiliations), and the
  // date as YYYY/MM/DD — Google Scholar's inclusion guidelines.
  if (authorNames.length) other.citation_author = authorNames;
  const pubDate = scholarDate(article.publishedAt);
  if (pubDate) other.citation_publication_date = pubDate;
  const keywords = article.keywords.split(",").map((k) => k.trim()).filter(Boolean);
  if (keywords.length) other.citation_keywords = keywords.join("; ");
  const issn = identity.whitelabel ? identity.issn : article.journal?.issn;
  if (issn) other.citation_issn = issn;
  if (article.issue?.volume) other.citation_volume = String(article.issue.volume);
  if (article.issue?.issueNumber) other.citation_issue = String(article.issue.issueNumber);
  if (article.doi) other.citation_doi = article.doi;
  if (article.galleyPdfKey) {
    // Now genuinely fetchable with no login wall — see the galley route's
    // updated access rule (published articles are public, matching the
    // site's own Open Access / CC BY 4.0 claims and Google Scholar's hard
    // requirement that indexed full text not sit behind an auth gate.
    // Served from the article's own URL (./pdf/route.ts): Google Scholar
    // expects the PDF on the same site as the article page.
    other.citation_pdf_url = `${await tenantBaseUrl(identity.tenantId)}${articlePdfPath(articlePath(article.id, article.title))}`;
  }

  return {
    // Shouting all-caps titles are shown in title case in search results;
    // the citation_title tag above keeps the title exactly as published.
    title: searchTitle(displayCase(article.title), identity.whitelabel ? [identity.shortName] : [identity.publisher, identity.shortName], " — "),
    description: searchDescription(summary),
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: article.title,
      description: summary,
      url: canonicalUrl,
      type: "article",
      authors: authorNames,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: summary,
    },
    other,
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getPublishedArticle(id);
  if (!article) {
    const unpublished = await findArticle(id);
    if (!unpublished) notFound();
    return (
      <I18nProvider>
        <div className="min-h-dvh flex flex-col bg-background">
          <SiteHeader />
          <main className="flex-1">
            <ArticleRouteBootstrap articleId={unpublished.id}>
              <div className="min-h-[50vh]" aria-busy="true" />
            </ArticleRouteBootstrap>
          </main>
          <SiteFooter />
          <Toaster richColors position="top-right" />
        </div>
      </I18nProvider>
    );
  }
  // One address per article: old /article/<id> links land on the readable one.
  const canonicalPath = articlePath(article.id, article.title);
  if (`/article/${id}` !== canonicalPath && decodeURIComponent(`/article/${id}`) !== decodeURIComponent(canonicalPath)) {
    permanentRedirect(canonicalPath);
  }

  const authors = parseAuthors(article.authors);
  const authorNames = authors.map((a) => a.name).filter(Boolean).join(", ") || "the authors";
  const summary = article.laySummary || article.abstract;
  const citation = formatCitation({
    title: article.title,
    authors: article.authors,
    publishedAt: article.publishedAt,
    doi: article.doi,
    journalName: article.journal?.name,
    volume: article.issue?.volume,
    issueNumber: article.issue?.issueNumber,
  });
  const identity = await publisherIdentityForJournal(article.journal);
  const baseUrl = await tenantBaseUrl(identity.tenantId);
  const pdfUrl = article.galleyPdfKey ? articlePdfPath(articlePath(article.id, article.title)) : null;
  const references = await db.reference.findMany({ where: { articleId: article.id }, orderBy: { createdAt: "asc" }, select: { id: true, rawText: true } });
  const keywords = article.keywords.split(",").map((k) => k.trim()).filter(Boolean);
  const published = article.publishedAt
    ? article.publishedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : null;
  const journalLine = [
    article.journal?.name || identity.journalName,
    article.issue?.volume ? `Vol. ${article.issue.volume}` : null,
    article.issue?.issueNumber ? `No. ${article.issue.issueNumber}` : null,
    published,
  ].filter(Boolean).join(" · ");

  // schema.org/ScholarlyArticle JSON-LD — rendered server-side (unlike the
  // equivalent block in article-view.tsx, which only ever reaches
  // document.head via a client useEffect and so is invisible to any
  // crawler that doesn't execute JavaScript, the same gap
  // generateMetadata() above already fixed for citation_* meta tags).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    headline: article.title,
    abstract: article.abstract,
    description: summary,
    author: authors.map((a) => ({
      "@type": "Person",
      name: a.name,
      ...(a.affiliation ? { affiliation: { "@type": "Organization", name: a.affiliation } } : {}),
      ...(a.orcid ? { identifier: `https://orcid.org/${a.orcid}` } : {}),
    })),
    datePublished: article.publishedAt ? article.publishedAt.toISOString() : undefined,
    keywords: article.keywords,
    isPartOf: {
      "@type": "PublicationIssue",
      issueNumber: article.issue?.issueNumber,
      isPartOf: {
        "@type": "PublicationVolume",
        volumeNumber: article.issue?.volume,
        isPartOf: {
          "@type": "Periodical",
          name: article.journal?.name || identity.journalName,
          issn: identity.whitelabel ? identity.issn ?? undefined : article.journal?.issn,
        },
      },
    },
    publisher: {
      "@type": "Organization",
      name: identity.publisher,
    },
    identifier: article.doi ? `https://doi.org/${article.doi}` : undefined,
    url: `${baseUrl}${canonicalPath}`,
    inLanguage: ARTICLE_LANGUAGE,
    license: ARTICLE_LICENSE_URL,
  };

  // FAIR Signposting: typed <link>s (hoisted into <head> by React) that
  // point machines at the DOI, the authors' ORCIDs, the PDF and the
  // metadata records — see src/lib/signposting.ts.
  const signposts = landingPageSignposts({
    id: article.id,
    doi: article.doi,
    orcids: authors.map((a) => a.orcid ?? "").filter(Boolean),
    landingUrl: `${baseUrl}${canonicalPath}`,
    pdfUrl: pdfUrl ? `${baseUrl}${pdfUrl}` : null,
    origin: baseUrl,
  });

  const coins = coinsSpanProps({
    title: article.title,
    authors: article.authors,
    publishedAt: article.publishedAt,
    doi: article.doi,
    journalName: article.journal?.name,
    journalIssn: identity.whitelabel ? identity.issn : article.journal?.issn,
    volume: article.issue?.volume,
    issueNumber: article.issue?.issueNumber,
    year: article.issue?.year,
  });

  return (
    <I18nProvider>
      <div className="min-h-dvh flex flex-col bg-background">
        <SiteHeader />
        {signposts.map((l, i) => (
          <link key={`${l.rel}-${i}`} rel={l.rel} href={l.href} {...(l.type ? { type: l.type } : {})} />
        ))}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <main className="flex-1">
          {/* Always-present, real semantic HTML — this is what a crawler that
              doesn't execute JavaScript sees. ArticleRouteBootstrap replaces
              it with the full interactive ArticleView once the client
              hydrates, for real visitors. */}
          <ArticleRouteBootstrap articleId={article.id}>
            <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
              {/* Laid out the way Google Scholar's inclusion guidelines ask:
                  title in the <h1>, authors right under it, the citation
                  next to them, then the complete author-written abstract —
                  readable without scripts, clicks or scrolling — and the
                  references as an ordered list under a "References" heading. */}
              <p className="eyebrow">{article.discipline}</p>
              <h1 className="mt-2 font-display text-3xl font-semibold">{article.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">By {authorNames}</p>
              {journalLine && <p className="mt-1 text-sm text-muted-foreground">{journalLine}</p>}
              {article.doi && <p className="mt-1 text-sm text-muted-foreground">DOI: {article.doi}</p>}
              <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-foreground/80">
                <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 font-medium"><OpenAccessIcon /> Open access</span>
                <CcLicenceBadge code={JOURNAL_IDENTITY.license} />
              </p>
              <section className="mt-6" aria-labelledby="abstract-heading">
                <h2 id="abstract-heading" className="font-display text-xl font-semibold">Abstract</h2>
                <p className="mt-2 whitespace-pre-line leading-relaxed">{article.abstract}</p>
              </section>
              {keywords.length > 0 && <p className="mt-4 text-sm"><strong>Keywords:</strong> {keywords.join("; ")}</p>}
              {pdfUrl && (
                <p className="mt-6">
                  <a href={pdfUrl} className="font-medium text-primary underline">Download full text (PDF)</a>
                </p>
              )}
              <p className="mt-8 text-sm text-muted-foreground">{citation}</p>
              {references.length > 0 && (
                <section className="mt-10" aria-labelledby="references-heading">
                  <h2 id="references-heading" className="font-display text-xl font-semibold">References</h2>
                  <ol className="mt-3 list-decimal space-y-2 pl-6 text-sm">
                    {references.map((r) => <li key={r.id}>{r.rawText}</li>)}
                  </ol>
                </section>
              )}
              {/* OpenURL/COinS marker — lets Zotero's and Mendeley's browser
                  connectors auto-detect this article's metadata on the page. */}
              <span {...coins} />
            </article>
          </ArticleRouteBootstrap>
        </main>
        <SiteFooter />
        <Toaster richColors position="top-right" />
      </div>
    </I18nProvider>
  );
}
