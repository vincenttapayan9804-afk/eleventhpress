/**
 * Site-wide RSS 2.0 feed of recently published articles — the standard,
 * platform-agnostic syndication primitive most third-party discovery
 * surfaces (Apple News format converters, Google News, Flipboard, generic
 * feed readers) ingest without any per-platform OAuth integration: point
 * the directory's onboarding form at this URL once, same "validate the feed
 * URL, then every future publish just needs to appear in it" posture as
 * src/lib/podcast-rss.ts for podcast directories. This module only builds
 * the feed string; it has no network calls of its own.
 */
import { parseAuthors } from "@/lib/article";

export interface RssArticle {
  id: string;
  title: string;
  abstract: string;
  discipline: string;
  authors: string; // JSON-stringified ArticleAuthor[], as stored on Article
  doi: string | null;
  publishedAt: Date | string | null;
  canonicalUrl: string;
}

export interface RssFeedMeta {
  title: string;
  description: string;
  siteUrl: string;
  feedUrl: string;
  language: string; // BCP 47, e.g. "en"
}

function rfc2822(d: Date): string {
  return d.toUTCString();
}

function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

function buildItemXml(a: RssArticle): string {
  const pubDate = a.publishedAt ? new Date(a.publishedAt) : new Date();
  const authors = parseAuthors(a.authors);
  const authorNames = authors.map((au) => au.name).filter(Boolean).join(", ");
  const doiLine = a.doi ? `\n      <dc:identifier>doi:${esc(a.doi)}</dc:identifier>` : "";

  return `    <item>
      <title>${esc(a.title)}</title>
      <description>${esc(a.abstract)}</description>
      <link>${esc(a.canonicalUrl)}</link>
      <guid isPermaLink="true">${esc(a.canonicalUrl)}</guid>
      <pubDate>${rfc2822(pubDate)}</pubDate>
      <category>${esc(a.discipline)}</category>${authorNames ? `\n      <dc:creator>${esc(authorNames)}</dc:creator>` : ""}${doiLine}
    </item>`;
}

/** Builds a site-wide RSS 2.0 feed from a list of published articles, newest first. */
export function buildArticlesRss(meta: RssFeedMeta, articles: RssArticle[]): string {
  const items = articles.map(buildItemXml).join("\n");
  const lastBuildDate = articles[0]?.publishedAt ? rfc2822(new Date(articles[0].publishedAt)) : rfc2822(new Date());

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${esc(meta.title)}</title>
    <description>${esc(meta.description)}</description>
    <link>${esc(meta.siteUrl)}</link>
    <language>${esc(meta.language)}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${esc(meta.feedUrl)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
}
