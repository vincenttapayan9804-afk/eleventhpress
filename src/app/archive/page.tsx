import { SkipLink } from "@/components/skip-link";
import type { Metadata } from "next";
import { I18nProvider } from "@/components/i18n-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ArchiveList } from "@/components/archive-list";
import { archiveYears, recentArticles } from "@/lib/archive";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Article archive",
  description: "Every peer-reviewed, open-access article we have published, listed by date of publication, with links to each year's archive and every article.",
  alternates: { canonical: "/archive" },
};

/**
 * GET /archive — browse every published article by date: the articles
 * added in the last two weeks, then one link per year. Plain links only,
 * so search engines (Google Scholar in particular) can reach every article
 * without running JavaScript.
 */
export default async function ArchivePage() {
  const [years, recent] = await Promise.all([archiveYears(), recentArticles(14)]);
  const total = years.reduce((n, y) => n + y.count, 0);
  return (
    <I18nProvider>
      <div className="min-h-dvh flex flex-col bg-background">
        <SkipLink />
        <SiteHeader />
        <main id="main-content" className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
          <p className="eyebrow">Browse by date</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">Article archive</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Every published article, by date of publication{total ? ` — ${total} in all` : ""}. Pick a year to see its articles.
          </p>

          <section className="mt-8" aria-labelledby="years-heading">
            <h2 id="years-heading" className="font-display text-xl font-semibold">By year</h2>
            {years.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {years.map(({ year, count }) => (
                  <li key={year}>
                    <a href={`/archive/${year}`} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:border-primary hover:text-primary">
                      {year} <span className="text-xs text-muted-foreground">({count})</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No articles have been published yet.</p>
            )}
          </section>

          <section className="mt-10" aria-labelledby="recent-heading">
            <h2 id="recent-heading" className="font-display text-xl font-semibold">Added in the last two weeks</h2>
            {recent.length ? (
              <ArchiveList items={recent} />
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Nothing new in the last two weeks.</p>
            )}
          </section>
        </main>
        <SiteFooter />
      </div>
    </I18nProvider>
  );
}
