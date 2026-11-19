/**
 * FAIR Signposting (https://signposting.org/FAIR/), level 1.
 *
 * Typed links that let machines (harvesters, reference managers, Crossref
 * and DataCite crawlers, AI agents) navigate a scholarly object without
 * scraping: from the landing page to its persistent identifier, its
 * authors' ORCIDs, its content files and its metadata records, and from
 * each content file back to the landing page.
 *
 * Landing pages carry them as HTML <link> elements; content files (the PDF)
 * carry them in an RFC 8288 `Link` response header, since a PDF has no
 * <head>.
 */

export const ARTICLE_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";

export interface SignpostLink {
  rel: string;
  href: string;
  type?: string;
}

export interface SignpostArticle {
  id: string;
  doi?: string | null;
  orcids: string[];
  /** Absolute URL of the article landing page. */
  landingUrl: string;
  /** Absolute URL of the PDF galley, when one is published. */
  pdfUrl?: string | null;
  /** Origin the API lives on, e.g. https://eleventhpress.com */
  origin: string;
}

function orcidUrl(orcid: string): string {
  const bare = orcid.replace(/^https?:\/\/orcid\.org\//i, "").trim();
  return `https://orcid.org/${bare}`;
}

/** Links advertised by an article's landing page. */
export function landingPageSignposts(a: SignpostArticle): SignpostLink[] {
  const links: SignpostLink[] = [
    { rel: "cite-as", href: a.doi ? `https://doi.org/${a.doi}` : a.landingUrl },
    { rel: "type", href: "https://schema.org/ScholarlyArticle" },
    { rel: "type", href: "https://schema.org/AboutPage" },
    { rel: "license", href: ARTICLE_LICENSE_URL },
  ];
  for (const o of a.orcids) if (o) links.push({ rel: "author", href: orcidUrl(o) });
  if (a.pdfUrl) links.push({ rel: "item", href: a.pdfUrl, type: "application/pdf" });
  const exp = `${a.origin}/api/articles/${encodeURIComponent(a.id)}/export?format=`;
  links.push(
    { rel: "describedby", href: `${exp}ris`, type: "application/x-research-info-systems" },
    { rel: "describedby", href: `${exp}bibtex`, type: "application/x-bibtex" },
    { rel: "describedby", href: `${exp}marc`, type: "application/marcxml+xml" },
  );
  return links;
}

/** Links a content file (the PDF) points back with. */
export function contentFileSignposts(landingUrl: string, doi?: string | null): SignpostLink[] {
  return [
    { rel: "collection", href: landingUrl, type: "text/html" },
    { rel: "cite-as", href: doi ? `https://doi.org/${doi}` : landingUrl },
    { rel: "license", href: ARTICLE_LICENSE_URL },
  ];
}

/** Serialise as an RFC 8288 Link header value. */
export function toLinkHeader(links: SignpostLink[]): string {
  return links
    .map((l) => `<${l.href}>; rel="${l.rel}"${l.type ? `; type="${l.type}"` : ""}`)
    .join(", ");
}
