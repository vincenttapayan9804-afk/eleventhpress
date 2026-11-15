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
  return parseAuthors(article.authors).filter((a) => a && typeof a.name === "string" && a.name.trim());
}

const DEFAULT_JOURNAL_NAME = "EPIP Int. J. Multidiscip. Res.";

/** Plain text: tags stripped, entities decoded, whitespace collapsed to one line. */
function plain(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Mei Lin Tan" → { family: "Tan", given: "Mei Lin" }; honours "Tan, Mei Lin" and particles ("van der Berg"). */
export function splitPersonName(full: string): { family: string; given: string } {
  const name = plain(full).replace(/^(dr|prof|professor|mr|mrs|ms)\.?\s+/i, "");
  if (name.includes(",")) {
    const [family, ...rest] = name.split(",");
    return { family: family.trim(), given: rest.join(",").trim() };
  }
  const parts = name.split(" ").filter(Boolean);
  if (parts.length < 2) return { family: parts[0] ?? "", given: "" };
  const suffix = /^(jr\.?|sr\.?|ii|iii|iv)$/i.test(parts[parts.length - 1]) ? parts.pop()! : "";
  let i = parts.length - 1;
  // Lower-case particles belong to the family name: "Ludwig van Beethoven", "María de la Cruz".
  while (i > 1 && /^(van|von|der|den|de|del|della|di|da|dos|das|du|la|le|bin|binti|al|el|ter|ten)$/.test(parts[i - 1])) i--;
  const family = parts.slice(i).join(" ") + (suffix ? `, ${suffix}` : "");
  return { family, given: parts.slice(0, i).join(" ") };
}

function invertedName(full: string): string {
  const { family, given } = splitPersonName(full);
  return given ? `${family}, ${given}` : family;
}

function keywordList(k: string | null | undefined): string[] {
  return plain(k)
    .split(/[;,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function publishedDate(article: ExportableArticle): Date | null {
  if (!article.publishedAt) return null;
  const d = new Date(article.publishedAt);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** ASCII-only, for cite keys. */
function asciiFold(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "");
}

const TITLE_STOPWORDS = new Set(["a", "an", "the", "on", "of", "in", "and", "for", "to", "with", "at", "by", "from"]);

/** Conventional cite key: first author's family name + year + first significant title word ("tan2026microplastic"). */
export function citeKey(article: ExportableArticle): string {
  const first = authorsOf(article)[0];
  const family = first ? asciiFold(splitPersonName(first.name).family).toLowerCase() : "";
  const word = plain(article.title)
    .split(/\s+/)
    .map((w) => asciiFold(w).toLowerCase())
    .find((w) => w && !TITLE_STOPWORDS.has(w));
  const year = String(resolvedYear(article)).replace(/[^0-9]/g, "") || "nd";
  return `${family || "anon"}${year}${word ?? ""}` || "epip";
}

/** Escapes BibTeX/LaTeX special characters; Unicode is kept (UTF-8 .bib, read by BibLaTeX, Zotero, Mendeley, JabRef). */
function bibEsc(s: string): string {
  return plain(s)
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([{}&%$#_])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

/** Title: specials escaped and acronyms/proper capitals ("FTIR", "COVID-19", "pH") protected from style lower-casing. */
function bibTitle(s: string): string {
  return bibEsc(s)
    .split(" ")
    .map((tok) => {
      const m = /^([("'“‘]*)(.*?)([)"'”’.,:;!?]*)$/.exec(tok);
      if (!m || !m[2]) return tok;
      const core = m[2];
      const letters = core.replace(/\\[a-z]+\{\}|\\./gi, "");
      const caps = (letters.match(/[A-Z]/g) ?? []).length;
      // Two or more capitals (FTIR, COVID-19, R&D) or an inner capital (pH, mRNA).
      return caps >= 2 || /[a-z][A-Z]/.test(letters) ? `${m[1]}{${core}}${m[3]}` : tok;
    })
    .join(" ");
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function buildBibTeX(article: ExportableArticle): string {
  const authors = authorsOf(article);
  const d = publishedDate(article);
  const fields: [string, string | null | undefined, boolean?][] = [
    ["title", article.title ? bibTitle(article.title) : null],
    ["author", authors.length ? authors.map((a) => bibEsc(invertedName(a.name))).join(" and ") : null],
    ["journal", bibEsc(article.journalName ?? DEFAULT_JOURNAL_NAME)],
    ["year", String(resolvedYear(article))],
    ["month", d ? MONTHS[d.getUTCMonth()] : null, true],
    ["volume", article.volume != null ? String(article.volume) : null],
    ["number", article.issueNumber != null ? String(article.issueNumber) : null],
    ["publisher", article.publisher ? bibEsc(article.publisher) : null],
    ["issn", article.journalIssn || null],
    ["doi", article.doi || null],
    ["url", article.doi ? `https://doi.org/${article.doi}` : article.articleUrl || null],
    ["abstract", article.abstract ? bibEsc(article.abstract) : null],
    ["keywords", keywordList(article.keywords).length ? bibEsc(keywordList(article.keywords).join(", ")) : null],
    ["language", "english"],
  ];
  const present = fields.filter(([, v]) => v != null && v !== "");
  const width = Math.max(...present.map(([k]) => k.length));
  const body = present
    // A month macro (jan, feb, …) is written bare, as BibTeX expects.
    .map(([k, v, bare]) => `  ${k.padEnd(width)} = ${bare ? v : `{${v}}`}`)
    .join(",\n");
  return `@article{${citeKey(article)},\n${body}\n}\n`;
}

/** RIS (Research Information Systems) — CRLF lines, one tag per line, empty tags omitted. */
export function buildRis(article: ExportableArticle): string {
  const authors = authorsOf(article);
  const d = publishedDate(article);
  const lines: [string, string | null | undefined][] = [
    ["TY", "JOUR"],
    ["TI", plain(article.title)],
    ...authors.map((a): [string, string] => ["AU", invertedName(a.name)]),
    ["PY", String(resolvedYear(article))],
    ["DA", d ? `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}/` : null],
    ["T2", plain(article.journalName ?? DEFAULT_JOURNAL_NAME)],
    ["JO", plain(article.journalName ?? DEFAULT_JOURNAL_NAME)],
    ["VL", article.volume != null ? String(article.volume) : null],
    ["IS", article.issueNumber != null ? String(article.issueNumber) : null],
    ["SN", article.journalIssn || null],
    ["PB", article.publisher ? plain(article.publisher) : null],
    ["DO", article.doi || null],
    ["UR", article.doi ? `https://doi.org/${article.doi}` : article.articleUrl || null],
    ["L2", article.doi && article.articleUrl ? article.articleUrl : null],
    ["AB", article.abstract ? plain(article.abstract) : null],
    ...keywordList(article.keywords).map((k): [string, string] => ["KW", k]),
    ["LA", "English"],
  ];
  const body = lines.filter(([, v]) => v != null && v !== "").map(([tag, v]) => `${tag}  - ${v}`);
  return [...body, "ER  - ", ""].join("\r\n");
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

/** Adds the closing period MARC/ISBD punctuation expects, unless the text already ends in punctuation. */
function withPeriod(s: string): string {
  return /[.?!]$/.test(s) ? s : `${s}.`;
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
 * Names are inverted (100/700 "Family, Given,"), the journal is the host
 * item (773), and 008 is exactly 40 positions.
 */
export function buildMarcXml(article: ExportableArticle): string {
  const authors = authorsOf(article);
  const [firstAuthor, ...restAuthors] = authors;
  const yearValue = resolvedYear(article);
  const year = typeof yearValue === "number" ? String(yearValue) : "uuuu";
  const d = publishedDate(article);
  const dateStamp = (d ?? new Date()).toISOString().slice(2, 10).replace(/-/g, "");

  // Leader: a serial component part (bibliographic level 'b'), language
  // material (type 'a'), Unicode (char coding 'a'). The record-length and
  // base-address positions are placeholders — only meaningful for
  // byte-counted binary MARC, not this self-delimiting XML; every
  // MARCXML-consuming ILS reads around them.
  const leader = "00000nab a2200000 i 4500";
  // 008 — 00-05 date entered, 06 's' single date, 07-10 date 1, 11-14 date 2,
  // 15-17 place ("xx " unknown), 18-34 continuing-resource codes (blank),
  // 35-37 language, 38 modified record, 39 cataloguing source ('d' other).
  const f008 = `${dateStamp}s${year}    xx ${" ".repeat(17)}eng d`;

  const title = plain(article.title);
  const nonfiling = /^(the|an|a)\s/i.exec(title)?.[0].length ?? 0;
  const journal = plain(article.journalName ?? DEFAULT_JOURNAL_NAME);
  const issueText = [
    article.volume != null ? `Vol. ${article.volume}` : "",
    article.issueNumber != null ? `no. ${article.issueNumber}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  const related = [issueText, `(${year === "uuuu" ? "forthcoming" : year})`].filter(Boolean).join(" ");

  const keywordFields = keywordList(article.keywords).map((k) => marcDatafield("653", " ", " ", [["a", k]])).filter(Boolean);
  const nameField = (tag: string, a: ArticleAuthor) =>
    marcDatafield(tag, "1", " ", [["a", `${invertedName(a.name)},`], ["e", "author."], ["u", a.affiliation ? plain(a.affiliation) : ""]]);

  const record = [
    `  <record>`,
    `    <leader>${leader}</leader>`,
    marcControlfield("001", article.id ?? ""),
    marcControlfield("008", f008),
    article.doi ? marcDatafield("024", "7", " ", [["a", article.doi], ["2", "doi"]]) : "",
    marcDatafield("041", " ", " ", [["a", "eng"]]),
    firstAuthor ? nameField("100", firstAuthor) : "",
    marcDatafield("245", firstAuthor ? "1" : "0", String(Math.min(nonfiling, 9)), [["a", withPeriod(title)]]),
    marcDatafield("264", " ", "1", [["b", article.publisher ? `${plain(article.publisher)},` : ""], ["c", year === "uuuu" ? "[forthcoming]" : withPeriod(year)]]),
    marcDatafield("336", " ", " ", [["a", "text"], ["b", "txt"], ["2", "rdacontent"]]),
    marcDatafield("337", " ", " ", [["a", "computer"], ["b", "c"], ["2", "rdamedia"]]),
    marcDatafield("338", " ", " ", [["a", "online resource"], ["b", "cr"], ["2", "rdacarrier"]]),
    article.discipline ? marcDatafield("500", " ", " ", [["a", withPeriod(`Subject area: ${plain(article.discipline)}`)]]) : "",
    marcDatafield("506", "0", " ", [["a", "Open access."], ["f", "Unrestricted online access"], ["2", "star"]]),
    article.abstract ? marcDatafield("520", "3", " ", [["a", plain(article.abstract)]]) : "",
    marcDatafield("540", " ", " ", [["a", "Creative Commons Attribution 4.0 International (CC BY 4.0)"], ["u", "https://creativecommons.org/licenses/by/4.0/"]]),
    ...keywordFields,
    ...restAuthors.map((a) => nameField("700", a)).filter(Boolean),
    marcDatafield("773", "0", " ", [["t", journal], ["g", related], ["x", article.journalIssn || ""]]),
    article.doi ? marcDatafield("856", "4", "0", [["u", `https://doi.org/${article.doi}`], ["z", "Full text via DOI"]]) : "",
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

const WIKIDATA_CC_BY_4 = "Q20007257"; // Creative Commons Attribution 4.0 International

export function buildWikidataQuickStatements(article: ExportableArticle): string {
  const authors = authorsOf(article);
  const title = plain(article.title);
  const lines = ["CREATE"];
  lines.push(`LAST|Len|"${qsEscape(title)}"`);
  lines.push(`LAST|P31|${WIKIDATA_INSTANCE_OF_SCHOLARLY_ARTICLE}`);
  lines.push(`LAST|P1476|en:"${qsEscape(title)}"`);
  lines.push(`LAST|P407|${WIKIDATA_LANGUAGE_ENGLISH}`);
  if (article.publishedAt) {
    lines.push(`LAST|P577|${qsDate(new Date(article.publishedAt))}`);
  }
  if (article.doi) {
    // Wikidata stores DOIs in upper case (P356's format constraint).
    lines.push(`LAST|P356|"${qsEscape(article.doi.toUpperCase())}"`);
  }
  if (article.volume != null) lines.push(`LAST|P478|"${qsEscape(String(article.volume))}"`);
  if (article.issueNumber != null) lines.push(`LAST|P433|"${qsEscape(String(article.issueNumber))}"`);
  lines.push(`LAST|P275|${WIKIDATA_CC_BY_4}`);
  const fullText = article.articleUrl || (article.doi ? `https://doi.org/${article.doi}` : null);
  if (fullText) lines.push(`LAST|P953|"${qsEscape(fullText)}"`);
  authors.forEach((a, i) => {
    // Author name string, with its position in the byline (P1545 series ordinal).
    lines.push(`LAST|P2093|"${qsEscape(plain(a.name))}"|P1545|"${i + 1}"`);
  });
  return lines.join("\n") + "\n";
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
