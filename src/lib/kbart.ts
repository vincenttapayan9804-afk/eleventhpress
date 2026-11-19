/**
 * KBART Phase II title lists (NISO RP-9-2014, "Knowledge Bases And Related
 * Tools"). Libraries load these tab-separated files into their knowledge
 * bases and discovery services (Ex Libris Alma/Primo, EBSCO, OCLC
 * WorldCat, Google Scholar library links) so the publication shows up as
 * available in their catalogue and link resolver.
 *
 * Format rules from the recommended practice: UTF-8, tab-delimited, the
 * exact 25 Phase II column headers in order, one row per title, empty
 * string (not "null") for unknown values, dates as ISO 8601, no quoting.
 */

export const KBART_COLUMNS = [
  "publication_title",
  "print_identifier",
  "online_identifier",
  "date_first_issue_online",
  "num_first_vol_online",
  "num_first_issue_online",
  "date_last_issue_online",
  "num_last_vol_online",
  "num_last_issue_online",
  "title_url",
  "first_author",
  "title_id",
  "embargo_info",
  "coverage_depth",
  "notes",
  "publisher_name",
  "publication_type",
  "date_monograph_published_print",
  "date_monograph_published_online",
  "monograph_volume",
  "monograph_edition",
  "first_editor",
  "parent_publication_title_id",
  "preceding_publication_title_id",
  "access_type",
] as const;

type KbartRow = Partial<Record<(typeof KBART_COLUMNS)[number], string | number | null | undefined>>;

export interface KbartIssue {
  volume: number;
  issueNumber: number;
  year: number;
  publishedAt: Date | null;
}

export interface KbartJournal {
  id: string;
  name: string;
  issn?: string | null;
  eissn?: string | null;
  publisher: string;
  issues: KbartIssue[];
  titleUrl: string;
}

export interface KbartBook {
  id: string;
  title: string;
  isbn?: string | null;
  firstAuthor?: string | null;
  publishedAt: Date | null;
  titleUrl: string;
  publisher: string;
  /** Free to read (price 0). */
  free?: boolean;
}

/** Tabs and line breaks would break the file's structure. */
function clean(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/[\t\r\n]+/g, " ").trim();
}

function isoDate(d: Date | null | undefined, fallbackYear?: number): string {
  if (d) return d.toISOString().slice(0, 10);
  return fallbackYear ? String(fallbackYear) : "";
}

/** Issues sorted oldest → newest, by volume then issue number. */
function sortIssues(issues: KbartIssue[]): KbartIssue[] {
  return [...issues].sort((a, b) => a.volume - b.volume || a.issueNumber - b.issueNumber);
}

export function journalRow(j: KbartJournal): KbartRow {
  const issues = sortIssues(j.issues.filter((i) => i.publishedAt));
  const first = issues[0];
  return {
    publication_title: j.name,
    print_identifier: j.issn,
    online_identifier: j.eissn,
    date_first_issue_online: first ? isoDate(first.publishedAt, first.year) : "",
    num_first_vol_online: first?.volume,
    num_first_issue_online: first?.issueNumber,
    // Blank last-issue fields mean "coverage continues to the present".
    date_last_issue_online: "",
    num_last_vol_online: "",
    num_last_issue_online: "",
    title_url: j.titleUrl,
    title_id: j.id,
    coverage_depth: "fulltext",
    publisher_name: j.publisher,
    publication_type: "serial",
    access_type: "F", // free to read (open access)
  };
}

export function bookRow(b: KbartBook): KbartRow {
  return {
    publication_title: b.title,
    online_identifier: b.isbn,
    title_url: b.titleUrl,
    first_author: b.firstAuthor ? b.firstAuthor.split(/\s+/).pop() : "",
    title_id: b.id,
    coverage_depth: "fulltext",
    publisher_name: b.publisher,
    publication_type: "monograph",
    date_monograph_published_online: isoDate(b.publishedAt),
    access_type: b.free ? "F" : "P",
  };
}

export function buildKbart(rows: KbartRow[]): string {
  const lines = [KBART_COLUMNS.join("\t")];
  for (const r of rows) lines.push(KBART_COLUMNS.map((c) => clean(r[c])).join("\t"));
  return lines.join("\n") + "\n";
}

/** "ProviderName_Global_AllTitles_2026-11-19.txt" — KBART's file naming. */
export function kbartFilename(provider: string, now = new Date()): string {
  const slug = provider.replace(/[^A-Za-z0-9]+/g, "") || "Publisher";
  return `${slug}_Global_AllTitles_${now.toISOString().slice(0, 10)}.txt`;
}
