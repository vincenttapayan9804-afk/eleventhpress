import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseAuthors } from "@/lib/article";

/**
 * GET /api/authors
 * Public directory aggregated from every PUBLISHED article's `authors` JSON
 * field (not just registered accounts — most co-authors never register).
 * Grouped by ORCID where present, otherwise by normalized name, so the same
 * person's stats roll up across all their published articles.
 */
export async function GET() {
  const articles = await db.article.findMany({
    where: { status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      discipline: true,
      authors: true,
      publishedAt: true,
      doi: true,
      views: true,
      downloads: true,
      citations: true,
    },
    orderBy: { publishedAt: "desc" },
  });

  interface Entry {
    key: string;
    name: string;
    affiliation: string;
    orcid: string | null;
    disciplines: Set<string>;
    articleCount: number;
    totalViews: number;
    totalDownloads: number;
    totalCitations: number;
    articles: { id: string; title: string; discipline: string; publishedAt: Date | null; doi: string | null }[];
  }

  const byKey = new Map<string, Entry>();

  for (const a of articles) {
    for (const au of parseAuthors(a.authors)) {
      if (!au.name) continue;
      const key = (au.orcid || au.name).trim().toLowerCase();
      let entry = byKey.get(key);
      if (!entry) {
        entry = {
          key,
          name: au.name,
          affiliation: au.affiliation || "",
          orcid: au.orcid || null,
          disciplines: new Set(),
          articleCount: 0,
          totalViews: 0,
          totalDownloads: 0,
          totalCitations: 0,
          articles: [],
        };
        byKey.set(key, entry);
      }
      entry.articleCount += 1;
      entry.totalViews += a.views;
      entry.totalDownloads += a.downloads;
      entry.totalCitations += a.citations;
      entry.disciplines.add(a.discipline);
      entry.articles.push({ id: a.id, title: a.title, discipline: a.discipline, publishedAt: a.publishedAt, doi: a.doi });
    }
  }

  const authors = [...byKey.values()]
    .map((e) => ({ ...e, disciplines: [...e.disciplines] }))
    .sort((a, b) => b.articleCount - a.articleCount || b.totalCitations - a.totalCitations || a.name.localeCompare(b.name));

  return NextResponse.json({ authors, total: authors.length });
}
