/**
 * Plain-text in-text/reference-list citation rendering across the style
 * guides different disciplines actually require — humanities (MLA,
 * Chicago), sciences/engineering (CSE, IEEE, AMA, ACS, NLM), general
 * international use (Harvard), and law (Bluebook, OSCOLA). This sits
 * alongside, not instead of, the machine-readable RIS/BibTeX exports in
 * citation-export.ts: those two are reference-manager import formats
 * (style-agnostic), while everything here is the human-readable string a
 * reader pastes straight into a manuscript's reference list.
 *
 * Every style guide has edge cases (journal-name abbreviation tables,
 * page-range rules, italics that a plain-text <pre> block can't render)
 * this deliberately doesn't chase — it renders the fields the platform
 * actually has (title, authors, journal, volume/issue, year, DOI) in each
 * style's real author-list and punctuation conventions, and simply omits
 * a field it doesn't have rather than inventing one.
 */
import { formatCitation, parseAuthors } from "@/lib/article";
import type { ExportableArticle } from "@/lib/citation-export";

const DEFAULT_JOURNAL_NAME = "EPIP Int. J. Multidiscip. Res.";

function resolvedYear(article: ExportableArticle): number | string {
  return article.publishedAt
    ? new Date(article.publishedAt).getFullYear()
    : article.year ?? "forthcoming";
}

function journalOf(article: ExportableArticle): string {
  return article.journalName ?? DEFAULT_JOURNAL_NAME;
}

function doiUrl(article: ExportableArticle): string | null {
  return article.doi ? `https://doi.org/${article.doi}` : null;
}

interface NameParts {
  first: string;
  last: string;
  initialsDotted: string;
  initialsPlain: string;
}

function splitName(full: string): NameParts {
  const parts = full.replace(/^Dr\.?\s+|^Prof\.?\s+/, "").trim().split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1] ?? full;
  const firstParts = parts.slice(0, -1);
  const first = firstParts.join(" ");
  const initialsDotted = firstParts.map((p) => `${p.charAt(0).toUpperCase()}.`).join(" ");
  const initialsPlain = firstParts.map((p) => p.charAt(0).toUpperCase()).join("");
  return { first, last, initialsDotted, initialsPlain };
}

function namesOf(article: ExportableArticle): NameParts[] {
  return parseAuthors(article.authors).map((a) => splitName(a.name));
}

/** Appends a sentence-ending period to an author list unless it already ends in one (e.g. an "et al." or initials tail), avoiding a doubled ".."  */
function withPeriod(s: string): string {
  return s.endsWith(".") ? s : `${s}.`;
}

function joinWithAnd(items: string[], conjunction = "and"): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, ${conjunction} ${items[items.length - 1]}`;
}

// ---- Per-style author-list conventions ----

function mlaAuthorList(names: NameParts[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0].last}, ${names[0].first}`.replace(/,\s*$/, "");
  if (names.length === 2) return `${names[0].last}, ${names[0].first}, and ${names[1].first} ${names[1].last}`;
  return `${names[0].last}, ${names[0].first}, et al.`;
}

function chicagoAuthorDateList(names: NameParts[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0].last}, ${names[0].first}`.replace(/,\s*$/, "");
  if (names.length <= 3) {
    const first = `${names[0].last}, ${names[0].first}`.replace(/,\s*$/, "");
    const rest = names.slice(1).map((n) => `${n.first} ${n.last}`.trim());
    return joinWithAnd([first, ...rest]);
  }
  return `${names[0].last}, ${names[0].first}, et al.`.replace(", ,", ",");
}

function chicagoNotesList(names: NameParts[]): string {
  if (names.length === 0) return "";
  const full = names.map((n) => `${n.first} ${n.last}`.trim());
  if (names.length <= 3) return joinWithAnd(full);
  return `${full[0]}, et al.`;
}

function harvardList(names: NameParts[]): string {
  if (names.length === 0) return "";
  const list = names.map((n) => (n.first ? `${n.last}, ${n.initialsDotted}` : n.last));
  if (list.length <= 3) return joinWithAnd(list);
  return `${list[0]}, et al.`;
}

function cseName(n: NameParts): string {
  return n.first ? `${n.last} ${n.initialsPlain}` : n.last;
}

function cseList(names: NameParts[]): string {
  const list = names.map(cseName);
  if (list.length <= 10) return list.join(", ");
  return `${list.slice(0, 10).join(", ")}, et al.`;
}

function ieeeName(n: NameParts): string {
  return n.first ? `${n.initialsDotted} ${n.last}` : n.last;
}

function ieeeList(names: NameParts[]): string {
  const list = names.map(ieeeName);
  if (list.length <= 6) return joinWithAnd(list);
  return `${list[0]} et al.`;
}

function amaName(n: NameParts): string {
  return n.first ? `${n.last} ${n.initialsPlain}` : n.last;
}

function amaList(names: NameParts[]): string {
  const list = names.map(amaName);
  if (list.length <= 6) return list.join(", ");
  return `${list.slice(0, 3).join(", ")}, et al.`;
}

function acsList(names: NameParts[]): string {
  return names.map((n) => (n.first ? `${n.last}, ${n.initialsDotted}` : n.last)).join("; ");
}

function nlmList(names: NameParts[]): string {
  const list = names.map(amaName);
  if (list.length <= 6) return list.join(", ");
  return `${list.slice(0, 6).join(", ")}, et al.`;
}

function bluebookList(names: NameParts[]): string {
  const full = names.map((n) => `${n.first} ${n.last}`.trim());
  if (full.length === 0) return "";
  if (full.length === 1) return full[0];
  if (full.length === 2) return `${full[0]} & ${full[1]}`;
  return `${full[0]} et al.`;
}

function oscolaList(names: NameParts[]): string {
  const full = names.map((n) => `${n.first} ${n.last}`.trim());
  if (full.length === 0) return "";
  if (full.length <= 3) return joinWithAnd(full);
  return `${full[0]} and others`;
}

// ---- Per-style full-citation formatters ----

export function formatMLA(article: ExportableArticle): string {
  const authorStr = mlaAuthorList(namesOf(article));
  const journal = journalOf(article);
  const bits: string[] = [];
  if (article.volume) bits.push(`vol. ${article.volume}`);
  if (article.issueNumber) bits.push(`no. ${article.issueNumber}`);
  bits.push(String(resolvedYear(article)));
  const doi = doiUrl(article);
  let out = `${authorStr ? `${withPeriod(authorStr)} ` : ""}"${article.title}." ${journal}, ${bits.join(", ")}`;
  out += doi ? `, ${doi}.` : ".";
  return out;
}

export function formatChicagoAuthorDate(article: ExportableArticle): string {
  const authorStr = chicagoAuthorDateList(namesOf(article));
  const journal = journalOf(article);
  const year = resolvedYear(article);
  const volIss = article.volume ? ` ${article.volume}${article.issueNumber ? `, no. ${article.issueNumber}` : ""}` : "";
  const doi = doiUrl(article);
  return `${authorStr ? `${withPeriod(authorStr)} ` : ""}${year}. "${article.title}." ${journal}${volIss}.${doi ? ` ${doi}.` : ""}`;
}

export function formatChicagoNotes(article: ExportableArticle): string {
  const authorStr = chicagoNotesList(namesOf(article));
  const journal = journalOf(article);
  const year = resolvedYear(article);
  const volIss = article.volume ? ` ${article.volume}${article.issueNumber ? `, no. ${article.issueNumber}` : ""}` : "";
  const doi = doiUrl(article);
  return `${authorStr ? `${authorStr}, ` : ""}"${article.title}," ${journal}${volIss} (${year})${doi ? `, ${doi}` : ""}.`;
}

export function formatHarvard(article: ExportableArticle): string {
  const authorStr = harvardList(namesOf(article));
  const journal = journalOf(article);
  const year = resolvedYear(article);
  const volIss = article.volume ? `${article.volume}${article.issueNumber ? `(${article.issueNumber})` : ""}` : "";
  const doi = doiUrl(article);
  return `${authorStr ? `${authorStr} ` : ""}${year}. ${article.title}. ${journal}${volIss ? `, ${volIss}` : ""}.${doi ? ` Available at: ${doi}.` : ""}`;
}

export function formatCseNameYear(article: ExportableArticle): string {
  const authorStr = cseList(namesOf(article));
  const journal = journalOf(article);
  const year = resolvedYear(article);
  const volIss = article.volume ? `${article.volume}${article.issueNumber ? `(${article.issueNumber})` : ""}` : "";
  const doi = doiUrl(article);
  return `${authorStr ? `${withPeriod(authorStr)} ` : ""}${year}. ${article.title}. ${journal}${volIss ? `. ${volIss}` : ""}.${doi ? ` ${doi}.` : ""}`;
}

export function formatCseCitationSequence(article: ExportableArticle): string {
  const authorStr = cseList(namesOf(article));
  const journal = journalOf(article);
  const year = resolvedYear(article);
  const volIss = article.volume ? `${article.volume}${article.issueNumber ? `(${article.issueNumber})` : ""}` : "";
  const doi = doiUrl(article);
  return `${authorStr ? `${withPeriod(authorStr)} ` : ""}${article.title}. ${journal}. ${year}${volIss ? `;${volIss}` : ""}.${doi ? ` ${doi}.` : ""}`;
}

export function formatIEEE(article: ExportableArticle): string {
  const authorStr = ieeeList(namesOf(article));
  const journal = journalOf(article);
  const bits: string[] = [];
  if (article.volume) bits.push(`vol. ${article.volume}`);
  if (article.issueNumber) bits.push(`no. ${article.issueNumber}`);
  bits.push(String(resolvedYear(article)));
  let out = `[1] ${authorStr ? `${authorStr}, ` : ""}"${article.title}," ${journal}, ${bits.join(", ")}`;
  out += article.doi ? `, doi: ${article.doi}.` : ".";
  return out;
}

export function formatAMA(article: ExportableArticle): string {
  const authorStr = amaList(namesOf(article));
  const journal = journalOf(article);
  const year = resolvedYear(article);
  const volIss = article.volume ? `${article.volume}${article.issueNumber ? `(${article.issueNumber})` : ""}` : "";
  return `${authorStr ? `${withPeriod(authorStr)} ` : ""}${article.title}. ${journal}. ${year}${volIss ? `;${volIss}` : ""}.${article.doi ? ` doi:${article.doi}` : ""}`;
}

export function formatACS(article: ExportableArticle): string {
  const authorStr = acsList(namesOf(article));
  const journal = journalOf(article);
  const year = resolvedYear(article);
  const vol = article.volume ? `, ${article.volume}` : "";
  const doi = doiUrl(article);
  return `${authorStr ? `${withPeriod(authorStr)} ` : ""}${article.title}. ${journal} ${year}${vol}.${doi ? ` ${doi}.` : ""}`;
}

export function formatNLM(article: ExportableArticle): string {
  const authorStr = nlmList(namesOf(article));
  const journal = journalOf(article);
  const year = resolvedYear(article);
  const volIss = article.volume ? `${article.volume}${article.issueNumber ? `(${article.issueNumber})` : ""}` : "";
  const doi = doiUrl(article);
  return `${authorStr ? `${withPeriod(authorStr)} ` : ""}${article.title}. ${journal}. ${year}${volIss ? `;${volIss}` : ""}.${doi ? ` Available from: ${doi}` : ""}`;
}

export function formatBluebook(article: ExportableArticle): string {
  const authorStr = bluebookList(namesOf(article));
  const journal = journalOf(article);
  const year = resolvedYear(article);
  const vol = article.volume ? `${article.volume} ` : "";
  const doi = doiUrl(article);
  return `${authorStr ? `${authorStr}, ` : ""}${article.title}, ${vol}${journal}${doi ? ` (${year}), ${doi}` : ` (${year})`}.`;
}

export function formatOSCOLA(article: ExportableArticle): string {
  const authorStr = oscolaList(namesOf(article));
  const journal = journalOf(article);
  const year = resolvedYear(article);
  const vol = article.volume ? `${article.volume} ` : "";
  const doi = doiUrl(article);
  return `${authorStr ? `${authorStr}, ` : ""}'${article.title}' (${year}) ${vol}${journal}${doi ? ` <${doi}>` : ""}.`;
}

export type CitationStyleId =
  | "apa"
  | "mla"
  | "chicago-author-date"
  | "chicago-notes"
  | "harvard"
  | "cse-name-year"
  | "cse-citation-sequence"
  | "ieee"
  | "ama"
  | "acs"
  | "nlm"
  | "bluebook"
  | "oscola";

export interface CitationStyleDef {
  id: CitationStyleId;
  label: string;
  format: (article: ExportableArticle) => string;
}

/** Order shown in the Cite tab's style dropdown. */
export const CITATION_STYLES: CitationStyleDef[] = [
  { id: "apa", label: "APA (7th ed.)", format: formatCitation },
  { id: "mla", label: "MLA (9th ed.)", format: formatMLA },
  { id: "chicago-author-date", label: "Chicago (Author–Date)", format: formatChicagoAuthorDate },
  { id: "chicago-notes", label: "Chicago (Notes–Bibliography)", format: formatChicagoNotes },
  { id: "harvard", label: "Harvard", format: formatHarvard },
  { id: "cse-name-year", label: "CSE (Name–Year)", format: formatCseNameYear },
  { id: "cse-citation-sequence", label: "CSE (Citation–Sequence)", format: formatCseCitationSequence },
  { id: "ieee", label: "IEEE", format: formatIEEE },
  { id: "ama", label: "AMA (11th ed.)", format: formatAMA },
  { id: "acs", label: "ACS", format: formatACS },
  { id: "nlm", label: "NLM", format: formatNLM },
  { id: "bluebook", label: "Bluebook (21st ed.)", format: formatBluebook },
  { id: "oscola", label: "OSCOLA (4th ed.)", format: formatOSCOLA },
];

export function formatCitationStyle(article: ExportableArticle, style: CitationStyleId): string {
  return (CITATION_STYLES.find((s) => s.id === style) ?? CITATION_STYLES[0]).format(article);
}
