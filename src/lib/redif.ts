import { APP_BASE_URL } from "@/lib/site";

/**
 * ReDIF (Research Papers in Economics Document Information Format) —
 * plain-text metadata templates RePEc's own crawler pulls on a periodic
 * schedule, the same "publish a real crawlable feed" pattern this codebase
 * already uses for OAI-PMH (src/app/api/oai-pmh/route.ts) and sitemap.xml.
 * IDEAS and EconPapers are front-ends over the same RePEc database, so one
 * feed genuinely reaches all three.
 *
 * RePEc handles (RePEc:<archive-code>:...) require an archive code
 * assigned by RePEc's own registration process — a one-time human
 * application, not an API call, the same category as the ROAD/ISI/
 * ResearchBib/Citefactor/SAJI listings in directory-listings.ts. Until
 * REPEC_ARCHIVE_CODE is set, the feed still renders (real, valid ReDIF —
 * useful to hand a RePEc reviewer during that application), but the
 * handle prefix stays a clearly-marked placeholder so nothing here is
 * ever presented as a live, registered RePEc archive before it is one.
 */

const PLACEHOLDER_ARCHIVE_CODE = "pending-registration";

export function repecLiveMode(): boolean {
  return !!process.env.REPEC_ARCHIVE_CODE;
}

export function repecArchiveCode(): string {
  return process.env.REPEC_ARCHIVE_CODE || PLACEHOLDER_ARCHIVE_CODE;
}

const SERIES_CODE = "articles";
const REDIF_BASE_URL = `${APP_BASE_URL}/api/redif`;

export function buildArchiveTemplate(journal: { name: string; publisher: string }): string {
  const code = repecArchiveCode();
  return [
    "Template-Type: ReDIF-Archive 1.0",
    `Handle: RePEc:${code}`,
    `Name: ${journal.publisher}`,
    "Maintainer-Name: Editorial Office",
    "Maintainer-Email: editorial@eleventhpress.org",
    `Description: ${journal.name} — real-time open-access article metadata, harvested for RePEc/IDEAS/EconPapers.`,
    `URL: ${REDIF_BASE_URL}?type=series`,
  ].join("\n");
}

export function buildSeriesTemplate(journal: { name: string; publisher: string }): string {
  const code = repecArchiveCode();
  return [
    "Template-Type: ReDIF-Series 1.0",
    `Name: ${journal.name}`,
    `Provider-Name: ${journal.publisher}`,
    `Provider-Homepage: ${APP_BASE_URL}`,
    "Type: ReDIF-Paper",
    `Handle: RePEc:${code}:${SERIES_CODE}`,
    `URL: ${REDIF_BASE_URL}?type=papers`,
  ].join("\n");
}

export function buildPaperTemplate(article: {
  id: string;
  title: string;
  abstract: string;
  authors: string; // JSON string, [{ name }]
  keywords: string; // comma-separated
  doi: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  discipline: string;
}): string {
  const code = repecArchiveCode();
  const authors: Array<{ name: string }> = safeParseAuthors(article.authors);
  const authorLines = authors.flatMap((a) => [`Author-Name: ${a.name}`]);
  const keywords = article.keywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => `Keywords: ${k}`);
  const date = (article.publishedAt || article.createdAt).toISOString().split("T")[0];

  const lines = [
    "Template-Type: ReDIF-Paper 1.0",
    `Title: ${article.title}`,
    ...authorLines,
    `Abstract: ${article.abstract.replace(/\s+/g, " ").trim()}`,
    `Creation-Date: ${date}`,
    `Classification-JEL: ${article.discipline}`,
    ...keywords,
    `File-URL: ${APP_BASE_URL}/api/articles/${article.id}/galley?format=pdf`,
    "File-Format: Application/pdf",
    ...(article.doi ? [`File-URL: https://doi.org/${article.doi}`, "File-Format: text/html"] : []),
    `Handle: RePEc:${code}:${SERIES_CODE}:${article.id}`,
  ];
  return lines.join("\n");
}

function safeParseAuthors(s: string): Array<{ name: string }> {
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
