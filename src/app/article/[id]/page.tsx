import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { presignGet } from "@/lib/storage";
import { parseAuthors, formatCitation } from "@/lib/article";
import { coinsSpanProps } from "@/lib/citation-export";
import { APP_BASE_URL, ARTICLE_LANGUAGE } from "@/lib/site";
import { I18nProvider } from "@/components/i18n-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/sonner";
import { AuthSheet } from "@/components/auth-sheet";
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

async function getPublishedArticle(id: string) {
  const article = await db.article.findUnique({
    where: { id },
    include: { journal: true, issue: true },
  });
  if (!article || article.status !== "PUBLISHED") return null;
  return article;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const article = await getPublishedArticle(id);
  if (!article) return { title: "Article not found" };

  const authors = parseAuthors(article.authors);
  const authorNames = authors.map((a) => a.name).filter(Boolean);
  const summary = (article.laySummary || article.abstract).slice(0, 300);
  const canonicalUrl = `${APP_BASE_URL}/article/${article.id}`;

  const other: Record<string, string | string[]> = {
    citation_title: article.title,
    citation_author: authorNames.length ? authorNames : ["the authors"],
    citation_journal_title: article.journal?.name || "Eleventh Press International Publishing",
    citation_publisher: article.journal?.publisher || "Eleventh Press International Publishing",
    citation_abstract_html_url: canonicalUrl,
    citation_language: ARTICLE_LANGUAGE,
  };
  if (article.publishedAt) other.citation_publication_date = article.publishedAt.toISOString().split("T")[0];
  if (article.journal?.issn) other.citation_issn = article.journal.issn;
  if (article.issue?.volume) other.citation_volume = String(article.issue.volume);
  if (article.issue?.issueNumber) other.citation_issue = String(article.issue.issueNumber);
  if (article.doi) other.citation_doi = article.doi;
  if (article.galleyPdfKey) {
    // Now genuinely fetchable with no login wall — see the galley route's
    // updated access rule (published articles are public, matching the
    // site's own Open Access / CC BY 4.0 claims and Google Scholar's hard
    // requirement that indexed full text not sit behind an auth gate.
    other.citation_pdf_url = await presignGet(article.galleyPdfKey, `${article.doi?.replace(/[^a-z0-9]/gi, "-") || article.id}.pdf`);
  }

  return {
    title: `${article.title} — Eleventh Press International Publishing`,
    description: summary,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: article.title,
      description: summary,
      url: canonicalUrl,
      type: "article",
      authors: authorNames,
    },
    twitter: {
      card: "summary",
      title: article.title,
      description: summary,
    },
    other,
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getPublishedArticle(id);
  if (!article) notFound();

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
  const pdfUrl = article.galleyPdfKey ? await presignGet(article.galleyPdfKey, `${article.doi?.replace(/[^a-z0-9]/gi, "-") || article.id}.pdf`) : null;
  const coins = coinsSpanProps({
    title: article.title,
    authors: article.authors,
    publishedAt: article.publishedAt,
    doi: article.doi,
    journalName: article.journal?.name,
    journalIssn: article.journal?.issn,
    volume: article.issue?.volume,
    issueNumber: article.issue?.issueNumber,
    year: article.issue?.year,
  });

  return (
    <I18nProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <SiteHeader />
        <main className="flex-1">
          {/* Always-present, real semantic HTML — this is what a crawler that
              doesn't execute JavaScript sees. ArticleRouteBootstrap replaces
              it with the full interactive ArticleView once the client
              hydrates, for real visitors. */}
          <ArticleRouteBootstrap articleId={article.id}>
            <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
              <p className="eyebrow">{article.discipline}</p>
              <h1 className="mt-2 font-display text-3xl font-semibold">{article.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">By {authorNames}</p>
              {article.doi && <p className="mt-1 text-sm text-muted-foreground">DOI: {article.doi}</p>}
              <p className="mt-6 leading-relaxed">{summary}</p>
              {pdfUrl && (
                <p className="mt-6">
                  <a href={pdfUrl} className="font-medium text-primary underline">Download PDF</a>
                </p>
              )}
              <p className="mt-8 text-sm text-muted-foreground">{citation}</p>
              {/* OpenURL/COinS marker — lets Zotero's and Mendeley's browser
                  connectors auto-detect this article's metadata on the page. */}
              <span {...coins} />
            </article>
          </ArticleRouteBootstrap>
        </main>
        <SiteFooter />
        <AuthSheet />
        <Toaster richColors position="top-right" />
      </div>
    </I18nProvider>
  );
}
