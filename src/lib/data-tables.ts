/**
 * Extracts <table> elements straight out of an article's galley HTML for
 * the Supplemental Materials tab's "Interactive Data Visualization"
 * section — plain regex, matching this codebase's established
 * no-DOM-parser convention (src/lib/alt-text.ts's extractImgTags()),
 * since MANUSCRIPT_SANITIZE_OPTIONS (src/lib/galley.ts) already
 * constrains table markup to a small, predictable tag set.
 *
 * This only ever visualizes numeric data that's genuinely present in a
 * table the article itself contains — never a fabricated or inferred
 * chart. An article with no tables (or none with numeric columns) simply
 * has nothing to show here; callers must render that honestly rather
 * than a chart with invented data.
 */

export interface ExtractedTable {
  headers: string[];
  rows: string[][];
  /** Column indexes (0-based) holding genuine numeric measurements: most
   * data-row values parse as numbers, and the column isn't just the row
   * numbering ("1.", "2.", … or 1, 2, 3 … down the first column). */
  numericColumns: number[];
  /** Row indexes (into `rows`) that are in-table sub-headings rather than
   * data — e.g. "B. | SELF-EFFICACY | 1 | 2 | 3 | 4 | 5" repeating the
   * header's scale. Rendered as section dividers, never plotted. */
  sectionRows: number[];
  /** Column whose text labels each row on a chart; -1 = use "Row N". */
  labelColumn: number;
  /** The table's own <caption>, when the manuscript has one. */
  caption?: string;
}

const TABLE_PATTERN = /<table\b[^>]*>[\s\S]*?<\/table>/gi;
const ROW_PATTERN = /<tr\b[^>]*>[\s\S]*?<\/tr>/gi;
const HEADER_CELL_PATTERN = /<th\b[^>]*>([\s\S]*?)<\/th>/gi;
const DATA_CELL_PATTERN = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
const CAPTION_PATTERN = /<caption\b[^>]*>([\s\S]*?)<\/caption>/i;

/** Cell HTML → plain text. Line breaks and block boundaries inside a cell
 * (a manuscript's "PERSONAL RESPONSIBILITY<br>In our…" or two <p>s) become
 * a space, so words on separate lines never run together. */
export function stripTagsAndDecode(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr|dd|dt)\s*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function matchAllCells(row: string, pattern: RegExp): string[] {
  pattern.lastIndex = 0;
  const cells: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(row))) {
    cells.push(stripTagsAndDecode(m[1]));
  }
  return cells;
}

/** True when a cell value parses as a real number after stripping common
 * formatting characters ($, %, commas, whitespace). */
function parsesAsNumber(cell: string): boolean {
  const cleaned = cell.replace(/[$,%\s]/g, "");
  if (!cleaned) return false;
  return !isNaN(Number(cleaned));
}

/** Parses a cell as a number ($, %, commas, spaces stripped); null when it
 * isn't one. Blank cells are null too — a missing value, never a zero. */
export function parseNumericCell(cell: string | undefined): number | null {
  const cleaned = (cell || "").replace(/[$,%\s]/g, "");
  if (!cleaned || isNaN(Number(cleaned))) return null;
  return Number(cleaned);
}

/** A row that repeats the header's own values in two or more non-label
 * columns (a Likert "1 2 3 4 5" scale restated under each section title)
 * is a sub-heading, not data. */
function isSectionRow(row: string[], headers: string[]): boolean {
  let repeats = 0;
  for (let i = 1; i < row.length; i++) {
    const cell = (row[i] || "").trim();
    if (!cell) continue;
    if (headers[i] !== undefined && cell === headers[i].trim()) repeats++;
    else if (i >= 2) return false;
  }
  return repeats >= 2;
}

/** Row numbering in the first column: enumerators like "1." / "2)" or a
 * plain 1, 2, 3 … (or 0, 1, 2 …) count — not a measurement worth plotting. */
function isIndexColumn(values: string[]): boolean {
  const nums = values.filter((v) => parsesAsNumber(v));
  if (nums.length < 2) return false;
  if (nums.filter((v) => /^\s*\d+\s*[.)]+\s*$/.test(v)).length / nums.length >= 0.6) return true;
  const parsed = nums.map((v) => Number(v.replace(/[$,%\s]/g, "")));
  return (parsed[0] === 0 || parsed[0] === 1) && parsed.every((n, i) => Number.isInteger(n) && (i === 0 || n === parsed[i - 1] + 1));
}

function numericColumnsOf(rows: string[][]): number[] {
  if (rows.length === 0) return [];
  const columnCount = Math.max(...rows.map((r) => r.length));
  const numeric: number[] = [];
  for (let col = 0; col < columnCount; col++) {
    const values = rows.map((r) => r[col]).filter((v): v is string => v !== undefined && v !== "");
    if (values.length < 2) continue;
    const numericCount = values.filter(parsesAsNumber).length;
    if (numericCount / values.length < 0.6) continue;
    if (col === 0 && columnCount > 1 && isIndexColumn(values)) continue;
    numeric.push(col);
  }
  return numeric;
}

/** First column that isn't numeric and actually carries text in the data
 * rows; falls back to the row-numbering column, then to none. */
function labelColumnOf(rows: string[][], numeric: number[]): number {
  if (rows.length === 0) return -1;
  const columnCount = Math.max(...rows.map((r) => r.length));
  for (let col = 0; col < columnCount; col++) {
    if (numeric.includes(col)) continue;
    if (rows.some((r) => (r[col] || "").trim() && !parsesAsNumber(r[col]))) return col;
  }
  return numeric.includes(0) || columnCount === 0 ? -1 : 0;
}

export function extractTables(html: string): ExtractedTable[] {
  const tableBlocks = html.match(TABLE_PATTERN) || [];

  return tableBlocks.map((block) => {
    const rowBlocks = block.match(ROW_PATTERN) || [];
    const captionMatch = block.match(CAPTION_PATTERN);
    const caption = captionMatch ? stripTagsAndDecode(captionMatch[1]) || undefined : undefined;
    if (rowBlocks.length === 0) return { headers: [], rows: [], numericColumns: [], sectionRows: [], labelColumn: -1, caption };

    const headerCells = matchAllCells(rowBlocks[0], HEADER_CELL_PATTERN);
    // First row's <th> cells if it has any, else fall back to treating its
    // <td> cells as headers (some manuscripts don't mark up a real <thead>).
    const headers = headerCells.length > 0 ? headerCells : matchAllCells(rowBlocks[0], DATA_CELL_PATTERN);
    const rows = rowBlocks
      .slice(1)
      .map((r) => matchAllCells(r, DATA_CELL_PATTERN))
      .filter((r) => r.length > 0);

    const sectionRows = rows.flatMap((r, i) => (isSectionRow(r, headers) ? [i] : []));
    const dataRows = rows.filter((_, i) => !sectionRows.includes(i));
    let numericColumns = numericColumnsOf(dataRows);
    let labelColumn = labelColumnOf(dataRows, numericColumns);
    // No text column (e.g. Year | Submissions | Accepted): the leading
    // numeric column is the x-axis, not a series.
    if (labelColumn === -1 && numericColumns[0] === 0 && numericColumns.length > 1) {
      labelColumn = 0;
      numericColumns = numericColumns.slice(1);
    }
    return { headers, rows, numericColumns, sectionRows, labelColumn, caption };
  }).filter((t) => t.headers.length > 0 || t.rows.length > 0);
}

/** The rows a chart plots: data rows (no sub-headings) with at least one
 * real value in a numeric column. */
export function chartRows(table: Pick<ExtractedTable, "rows" | "numericColumns"> & { sectionRows?: number[] }): number[] {
  const sections = new Set(table.sectionRows ?? []);
  return table.rows.flatMap((row, i) =>
    !sections.has(i) && table.numericColumns.some((c) => parseNumericCell(row[c]) !== null) ? [i] : []
  );
}

/** True when a table has at least one numeric column and enough rows with
 * real values to be worth charting (a single data point isn't a chart). */
export function isChartable(table: ExtractedTable): boolean {
  return table.numericColumns.length > 0 && chartRows(table).length >= 2;
}
