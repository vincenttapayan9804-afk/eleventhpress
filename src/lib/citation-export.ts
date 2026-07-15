/**
 * Reference-manager interoperability via open, unauthenticated standards —
 * no vendor account or API needed for any of this. Zotero and Mendeley's
 * browser connectors already auto-detect a page via the citation_* meta
 * tags generateMetadata() emits (src/app/article/[id]/page.tsx) and via the
 * COinS tag built here; EndNote needs no separate export format since it
 * natively imports RIS/BibTeX like the others.
 */
import { parseAuthors, type ArticleAuthor } from "@/lib/article";

export interface ExportableArticle {
  title: string;
  authors: string; // JSON-stringified ArticleAuthor[]
  publishedAt?: Date | string | null;
  doi?: string | null;
  journalName?: string | null;
  journalIssn?: string | null;
  volume?: number | null;
  issueNumber?: number | null;
  year?: number | null;
}

function resolvedYear(article: ExportableArticle): number | string {
  return article.publishedAt
    ? new Date(article.publishedAt).getFullYear()
    : article.year ?? "forthcoming";
}

function authorsOf(article: ExportableArticle): ArticleAuthor[] {
  return parseAuthors(article.authors);
}

const DEFAULT_JOURNAL_NAME = "EPIP Int. J. Multidiscip. Res.";

export function buildBibTeX(article: ExportableArticle): string {
  const authors = authorsOf(article);
  const key = article.doi?.replace(/[^a-z0-9]/gi, "") || "epip";
  return `@article{${key},
  title   = {${article.title}},
  author  = {${authors.map((a) => a.name).join(" and ")}},
  journal = {${article.journalName ?? DEFAULT_JOURNAL_NAME}},
  year    = {${resolvedYear(article)}},
  volume  = {${article.volume ?? ""}},
  number  = {${article.issueNumber ?? ""}},
  issn    = {${article.journalIssn ?? ""}},
  doi     = {${article.doi ?? ""}},
}`;
}

export function buildRis(article: ExportableArticle): string {
  const authors = authorsOf(article);
  return `TY  - JOUR
TI  - ${article.title}
AU  - ${authors.map((a) => a.name).join("\nAU  - ")}
JO  - ${article.journalName ?? DEFAULT_JOURNAL_NAME}
PY  - ${resolvedYear(article)}
VL  - ${article.volume ?? ""}
IS  - ${article.issueNumber ?? ""}
SN  - ${article.journalIssn ?? ""}
DO  - ${article.doi ?? ""}
ER  - `;
}

/**
 * OpenURL ContextObject KEV encoding (Z39.88-2004) — the query-string
 * format Zotero's/Mendeley's browser connectors and OpenURL link resolvers
 * scan a page for via a `<span class="Z3988" title="...">` marker. Returns
 * plain data (not an HTML string) so callers render it through JSX, which
 * handles attribute escaping correctly on its own.
 */
export function coinsSpanProps(article: ExportableArticle): { className: string; title: string } {
  const authors = authorsOf(article);
  const params = new URLSearchParams();
  params.set("ctx_ver", "Z39.88-2004");
  params.set("rft_val_fmt", "info:ofi/fmt:kev:mtx:journal");
  params.set("rft.genre", "article");
  params.set("rft.atitle", article.title);
  params.set("rft.jtitle", article.journalName ?? DEFAULT_JOURNAL_NAME);
  params.set("rft.date", String(resolvedYear(article)));
  if (article.volume) params.set("rft.volume", String(article.volume));
  if (article.issueNumber) params.set("rft.issue", String(article.issueNumber));
  if (article.journalIssn) params.set("rft.issn", article.journalIssn);
  for (const a of authors) params.append("rft.au", a.name);
  if (article.doi) params.set("rft_id", `info:doi/${article.doi}`);
  return { className: "Z3988", title: params.toString() };
}
