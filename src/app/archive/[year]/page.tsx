import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { I18nProvider } from "@/components/i18n-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ArchiveList } from "@/components/archive-list";
import { articlesInYear, type ArchiveItem } from "@/lib/archive";

export const dynamic = "force-dynamic";

function parseYear(raw: string): number | null {
  if (!/^\d{4}$/.test(raw)) return null;
  const y = Number(raw);
  return y >= 1900 && y <= 2100 ? y : null;
}

export async function generateMetadata({ params }: { params: Promise<{ year: string }> }): Promise<Metadata> {
  const { year } = await params;
  const y = parseYear(year);
  if (!y) return { title: "Article archive" };
  return {
    title: `Articles published in ${y}`,
    description: `Every article published in ${y}, by date of publication.`,
    alternates: { canonical: `/archive/${y}` },
  };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** GET /archive/<year> — every article published that year, grouped by month, newest first. */
export default async function ArchiveYearPage({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  const y = parseYear(year);
  if (!y) notFound();
  const items = await articlesInYear(y);
  if (!items.length) notFound();

  const byMonth = new Map<number, ArchiveItem[]>();
  for (const a of items) {
    const m = a.publishedAt.getUTCMonth();
    byMonth.set(m, [...(byMonth.get(m) ?? []), a]);
  }

  return (
    <I18nProvider>
      <div className="min-h-dvh flex flex-col bg-background">
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="text-sm">
            <a href="/archive" className="text-primary hover:underline">Article archive</a>
            <span className="text-muted-foreground"> / {y}</span>
          </nav>
          <h1 className="mt-3 font-display text-4xl font-semibold">Articles published in {y}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{items.length} article{items.length === 1 ? "" : "s"}, newest first.</p>
          {[...byMonth.entries()].map(([m, list]) => (
            <section key={m} className="mt-8" aria-labelledby={`m-${m}`}>
              <h2 id={`m-${m}`} className="font-display text-xl font-semibold">{MONTHS[m]} {y}</h2>
              <ArchiveList items={list} />
            </section>
          ))}
        </main>
        <SiteFooter />
      </div>
    </I18nProvider>
  );
}
