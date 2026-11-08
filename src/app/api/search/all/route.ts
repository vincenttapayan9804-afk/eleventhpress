import { NextRequest, NextResponse } from "next/server";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { withTenantRlsContext } from "@/lib/db-rls";
import { parseAuthors } from "@/lib/article";
import { articlePath } from "@/lib/spa-routes";
import { authorPath } from "@/lib/author-path";
import { BLOGS, GUIDES } from "@/lib/resources-content";

/**
 * GET /api/search/all?q=… — the ⌘K search: published articles, authors,
 * books, magazine issues, podcast episodes and Resources (blogs, guides),
 * each with the path to open. Public content only; case-insensitive
 * substring match, a handful of results per group.
 */
const PER_GROUP = 5;

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ groups: [] });
  const tenant = await resolveTenantFromHeaders(req.headers);
  const contains = { contains: q, mode: "insensitive" as const };
  const lower = q.toLowerCase();

  const [articles, authorRows, books, issues, episodes] = await withTenantRlsContext(tenant?.id ?? null, (tx) =>
    Promise.all([
      tx.article.findMany({
        where: { status: "PUBLISHED", OR: [{ title: contains }, { keywords: contains }, { abstract: contains }, { doi: contains }] },
        select: { id: true, title: true, discipline: true, publishedAt: true },
        orderBy: { publishedAt: "desc" },
        take: PER_GROUP,
      }),
      tx.article.findMany({ where: { status: "PUBLISHED", authors: contains }, select: { authors: true }, take: 50 }),
      tx.book.findMany({ where: { status: "PUBLISHED", tenantId: tenant?.id ?? null, OR: [{ title: contains }, { subtitle: contains }] }, select: { id: true, title: true }, take: PER_GROUP }).catch(() => []),
      tx.magazineIssue
        .findMany({
          where: { status: "PUBLISHED", OR: [{ title: contains }, { theme: contains }] },
          select: { id: true, title: true, theme: true, volume: true, issueNumber: true, year: true },
          take: PER_GROUP,
        })
        .catch(() => []),
      tx.podcastEpisode.findMany({ where: { status: "PUBLISHED", title: contains }, select: { id: true, title: true }, take: PER_GROUP }).catch(() => []),
    ])
  );

  const authorMap = new Map<string, { title: string; subtitle: string; path: string }>();
  for (const row of authorRows) {
    for (const a of parseAuthors(row.authors)) {
      if (!a.name || !a.name.toLowerCase().includes(lower)) continue;
      const path = authorPath(a);
      if (!authorMap.has(path)) authorMap.set(path, { title: a.name, subtitle: a.affiliation || "Author", path });
    }
  }

  const resources = [
    ...BLOGS.filter((b) => b.title.toLowerCase().includes(lower)).map((b) => ({ title: b.title, subtitle: "Blog", path: `/resources/blog/${b.slug}` })),
    ...GUIDES.filter((g) => g.title.toLowerCase().includes(lower)).map((g) => ({ title: g.title, subtitle: "Guide", path: `/resources/guides/${g.slug}` })),
  ].slice(0, PER_GROUP);

  const groups = [
    {
      key: "articles",
      label: "Articles",
      items: articles.map((a) => ({
        title: a.title,
        subtitle: `${a.discipline}${a.publishedAt ? ` · ${a.publishedAt.getFullYear()}` : ""}`,
        path: articlePath(a.id, a.title),
      })),
    },
    { key: "authors", label: "Authors", items: [...authorMap.values()].slice(0, PER_GROUP) },
    { key: "books", label: "Books", items: books.map((b) => ({ title: b.title, subtitle: "Book", path: "/books" })) },
    {
      key: "magazines",
      label: "Magazines",
      items: issues.map((i) => ({
        title: i.title || i.theme || `Vol. ${i.volume}, No. ${i.issueNumber}`,
        subtitle: `Vol. ${i.volume}, No. ${i.issueNumber} · ${i.year}`,
        path: `/magazines/${i.id}`,
      })),
    },
    { key: "podcasts", label: "Podcasts", items: episodes.map((e) => ({ title: e.title, subtitle: "Episode", path: "/podcasts" })) },
    { key: "resources", label: "Resources", items: resources },
  ].filter((g) => g.items.length > 0);

  return NextResponse.json({ groups }, { headers: { "Cache-Control": "private, max-age=30" } });
}
