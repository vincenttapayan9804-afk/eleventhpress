/**
 * Small helpers shared by the server-rendered article page and the
 * client-side article view for Google Scholar's citation_* meta tags.
 * See https://scholar.google.com/intl/en/scholar/inclusion.html#indexing.
 */

/**
 * Google Scholar wants citation_publication_date as "2010/5/12" (or a year
 * alone). Zero-padded "2010/05/12", as in their own example, is used here.
 */
export function scholarDate(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}/${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}`;
}

/** File name of the full-text PDF, served next to the article page. */
export const ARTICLE_PDF_FILE = "fulltext.pdf";

/**
 * The full-text PDF's path for an article page path, e.g.
 * "/article/title--id" -> "/article/title--id/fulltext.pdf". Ending in
 * ".pdf" and sitting under the article page's own path follows Google
 * Scholar's guidance for citation_pdf_url.
 */
export function articlePdfPath(articlePagePath: string): string {
  return `${articlePagePath.replace(/\/+$/, "")}/${ARTICLE_PDF_FILE}`;
}
