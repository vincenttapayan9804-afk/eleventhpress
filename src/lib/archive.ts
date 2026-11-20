import { headers } from "next/headers";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { withTenantRlsContext } from "@/lib/db-rls";
import { parseAuthors } from "@/lib/article";
import { articlePath } from "@/lib/spa-routes";

/**
 * Data for the browse-by-date archive (/archive, /archive/<year>): plain,
 * server-rendered HTML lists of every published article, linked with simple
 * GET links — the "browse interface" Google Scholar's crawl guidelines ask
 * for (https://scholar.google.com/intl/en/scholar/inclusion.html#crawl),
 * since the interactive Articles page loads its list with JavaScript.
 * Scoped to the site being viewed, like the sitemap.
 */
export interface ArchiveItem {
  path: string;
  title: string;
  authors: string;
  publishedAt: Date;
  journal: string | null;
  volume: number | null;
  issue: number | null;
}

async function published(where: Record<string, unknown> = {}) {
  const tenant = await resolveTenantFromHeaders(await headers()).catch(() => null);
  return withTenantRlsContext(tenant?.id ?? null, (tx) =>
    tx.article.findMany({
      where: { status: "PUBLISHED", publishedAt: { not: null }, ...where },
      select: {
        id: true,
        title: true,
        authors: true,
        publishedAt: true,
        journal: { select: { name: true } },
        issue: { select: { volume: true, issueNumber: true } },
      },
      orderBy: { publishedAt: "desc" },
    }),
  );
}

type Row = Awaited<ReturnType<typeof published>>[number];

function toItem(a: Row): ArchiveItem {
  return {
    path: articlePath(a.id, a.title),
    title: a.title,
    authors: parseAuthors(a.authors).map((x) => x.name).filter(Boolean).join(", "),
    publishedAt: a.publishedAt as Date,
    journal: a.journal?.name ?? null,
    volume: a.issue?.volume ?? null,
    issue: a.issue?.issueNumber ?? null,
  };
}

/** Years with published articles (newest first) and how many in each. */
export async function archiveYears(): Promise<{ year: number; count: number }[]> {
  const rows = await published();
  const counts = new Map<number, number>();
  for (const r of rows) {
    const y = (r.publishedAt as Date).getUTCFullYear();
    counts.set(y, (counts.get(y) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[0] - a[0]).map(([year, count]) => ({ year, count }));
}

/** Articles published in the last `days` days, newest first. */
export async function recentArticles(days = 14): Promise<ArchiveItem[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return (await published({ publishedAt: { gte: since } })).map(toItem);
}

/** Articles published in a calendar year (UTC), newest first. */
export async function articlesInYear(year: number): Promise<ArchiveItem[]> {
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));
  return (await published({ publishedAt: { gte: from, lt: to } })).map(toItem);
}

export function fmtArchiveDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
