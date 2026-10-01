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
  // Only used by buildMarcXml below — optional so the three export formats
  // above never need to pass them.
  id?: string;
  abstract?: string | null;
  keywords?: string | null; // comma-separated, as stored on Article
  discipline?: string | null;
  publisher?: string | null;
  articleUrl?: string | null;
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

function xmlEsc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function marcControlfield(tag: string, value: string): string {
  return `    <controlfield tag="${tag}">${xmlEsc(value)}</controlfield>`;
}

function marcDatafield(tag: string, ind1: string, ind2: string, subfields: [string, string][]): string {
  const present = subfields.filter(([, v]) => !!v);
  if (!present.length) return "";
  const body = present.map(([code, v]) => `      <subfield code="${code}">${xmlEsc(v)}</subfield>`).join("\n");
  return `    <datafield tag="${tag}" ind1="${ind1}" ind2="${ind2}">\n${body}\n    </datafield>`;
}

/**
 * MARCXML (MARC21 slim schema, loc.gov/standards/marcxml) — the standard
 * library-catalog interchange format integrated library systems (Ex Libris
 * Alma/Primo, Koha, Evergreen) ingest directly, distinct from the JATS XML
 * already generated for PMC/Scopus indexing (src/lib/galley.ts): that's a
 * full-text archival format, this is catalog/discovery metadata only.
 * Generates MARCXML rather than binary ISO 2709 MARC — every modern ILS
 * accepts MARCXML on import, and MARCXML's self-delimiting structure
 * avoids ISO 2709's fixed-width byte-offset failure modes entirely.
 */
export function buildMarcXml(article: ExportableArticle): string {
  const authors = authorsOf(article);
  const [firstAuthor, ...restAuthors] = authors;
  const year = String(resolvedYear(article));
  const dateStamp = article.publishedAt ? new Date(article.publishedAt).toISOString().slice(2, 10).replace(/-/g, "") : "000000";

  // Leader: a serial component part (bibliographic level 'b'), language
  // material (type 'a'), Unicode (char coding 'a'). The record-length and
  // base-address positions are placeholders — only meaningful for
  // byte-counted binary MARC, not this self-delimiting XML; every
  // MARCXML-consuming ILS reads around them.
  const leader = "00000naa a2200000 a 4500";

  const keywordFields = (article.keywords ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => marcDatafield("653", " ", " ", [["a", k]]))
    .filter(Boolean);

  const addedAuthorFields = restAuthors
    .map((a) => marcDatafield("700", "1", " ", [["a", a.name], ["u", a.affiliation || ""]]))
    .filter(Boolean);

  const record = [
    `  <record>`,
    `    <leader>${leader}</leader>`,
    marcControlfield("001", article.id ?? ""),
    marcControlfield("008", `${dateStamp}s${year}    xx            000 0 eng d`),
    marcDatafield("022", " ", " ", [["a", article.journalIssn ?? ""]]),
    article.doi ? marcDatafield("024", "7", " ", [["a", article.doi], ["2", "doi"]]) : "",
    firstAuthor ? marcDatafield("100", "1", " ", [["a", firstAuthor.name], ["u", firstAuthor.affiliation || ""]]) : "",
    marcDatafield("245", "1", "0", [["a", article.title]]),
    marcDatafield("264", " ", "1", [["b", article.publisher ?? ""], ["c", year]]),
    marcDatafield("500", " ", " ", [["a", [article.journalName, article.discipline].filter(Boolean).join(" — ")]]),
    article.abstract ? marcDatafield("520", " ", " ", [["a", article.abstract]]) : "",
    ...keywordFields,
    ...addedAuthorFields,
    article.articleUrl ? marcDatafield("856", "4", "0", [["u", article.articleUrl], ["z", "Full text"]]) : "",
    `  </record>`,
  ]
    .filter(Boolean)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<collection xmlns="http://www.loc.gov/MARC21/slim">\n${record}\n</collection>\n`;
}

export interface ExportableExternalSource {
  title?: string;
  authors?: string;
  year?: number | null;
  venue?: string | null;
  url: string;
}

/** Stable-ish BibTeX cite key from a URL — external sources (Research Lab
 * Gap Finder/PRISMA drafting tool) have no DOI to key off, so this hashes
 * the tail of the URL instead. Not guaranteed globally unique, but good
 * enough for a single exported .bib file covering one run's sources. */
function extKey(url: string): string {
  const cleaned = url.replace(/[^a-z0-9]/gi, "");
  return "ext" + (cleaned.slice(-24) || "source");
}

/**
 * Best-effort BibTeX/RIS for an external Research Lab source (Gap Finder/
 * PRISMA drafting tool) — these carry only whatever bibliographic metadata
 * the researcher pasted or the open-data discovery search returned
 * (title/authors/year/venue/url), never a full structured record the way
 * this platform's own articles do, so the entry is real but intentionally
 * sparser (@misc/ELEC type, an explicit "external source" note) rather
 * than padded out with invented fields to look like a full @article.
 */
export function buildBibTeXExternal(source: ExportableExternalSource): string {
  const title = source.title || source.url;
  return `@misc{${extKey(source.url)},
  title        = {${title}},
  author       = {${source.authors ?? ""}},
  year         = {${source.year ?? "n.d."}},
  howpublished = {${source.venue ? `${source.venue}. ` : ""}${source.url}},
  note         = {External source — not indexed by this platform},
}`;
}

export function buildRisExternal(source: ExportableExternalSource): string {
  const title = source.title || source.url;
  return `TY  - ELEC
TI  - ${title}
AU  - ${source.authors ?? ""}
PY  - ${source.year ?? ""}
PB  - ${source.venue ?? ""}
UR  - ${source.url}
ER  - `;
}

/**
 * Wikidata QuickStatements V1 batch — the real, documented input format
 * (https://quickstatements.toolforge.org/) editors and WikiProject
 * Source MetaData volunteers already use to bulk-create "scholarly
 * article" (Q13442814) items from a journal's bibliographic data. There
 * is no public unauthenticated submission API for Wikidata items (every
 * edit requires a logged-in Wikidata account, by design, to keep
 * provenance and vandalism-reversion working) — this generates the exact
 * command batch an editor pastes into QuickStatements' own web tool,
 * same "real, free, well-documented standard, applied through its own
 * actual workflow" honesty bar as directory-listings.ts's DOAJ/ROAD/etc.
 * entries. Only ever emits statements the platform actually has real
 * values for (title, DOI, pub date, author name strings, canonical URL)
 * — no fabricated Wikidata QIDs for authors, journal, or subject, since
 * this codebase doesn't track those.
 */
const WIKIDATA_INSTANCE_OF_SCHOLARLY_ARTICLE = "Q13442814"; // scholarly article
const WIKIDATA_LANGUAGE_ENGLISH = "Q1860"; // English — every published galley here originates in English (src/lib/galley-translation.ts translates FROM it)

function qsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function qsDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `+${y}-${m}-${day}T00:00:00Z/11`;
}

export function buildWikidataQuickStatements(article: ExportableArticle): string {
  const authors = authorsOf(article);
  const lines = ["CREATE"];
  lines.push(`LAST|Len|"${qsEscape(article.title)}"`);
  lines.push(`LAST|P31|${WIKIDATA_INSTANCE_OF_SCHOLARLY_ARTICLE}`);
  lines.push(`LAST|P1476|en:"${qsEscape(article.title)}"`);
  lines.push(`LAST|P407|${WIKIDATA_LANGUAGE_ENGLISH}`);
  if (article.publishedAt) {
    lines.push(`LAST|P577|${qsDate(new Date(article.publishedAt))}`);
  }
  if (article.doi) {
    lines.push(`LAST|P356|"${qsEscape(article.doi)}"`);
    lines.push(`LAST|P953|"https://doi.org/${qsEscape(article.doi)}"`);
  }
  for (const a of authors) {
    lines.push(`LAST|P2093|"${qsEscape(a.name)}"`);
  }
  return lines.join("\n");
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
