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
  /** Column indexes (0-based) where most values parse as numbers. */
  numericColumns: number[];
}

const TABLE_PATTERN = /<table\b[^>]*>[\s\S]*?<\/table>/gi;
const ROW_PATTERN = /<tr\b[^>]*>[\s\S]*?<\/tr>/gi;
const HEADER_CELL_PATTERN = /<th\b[^>]*>([\s\S]*?)<\/th>/gi;
const DATA_CELL_PATTERN = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;

function stripTagsAndDecode(html: string): string {
  const text = html.replace(/<[^>]*>/g, "").trim();
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
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

function numericColumnsOf(rows: string[][]): number[] {
  if (rows.length === 0) return [];
  const columnCount = Math.max(...rows.map((r) => r.length));
  const numeric: number[] = [];
  for (let col = 0; col < columnCount; col++) {
    const values = rows.map((r) => r[col]).filter((v): v is string => v !== undefined && v !== "");
    if (values.length === 0) continue;
    const numericCount = values.filter(parsesAsNumber).length;
    if (numericCount / values.length >= 0.6) numeric.push(col);
  }
  return numeric;
}

export function extractTables(html: string): ExtractedTable[] {
  const tableBlocks = html.match(TABLE_PATTERN) || [];

  return tableBlocks.map((block) => {
    const rowBlocks = block.match(ROW_PATTERN) || [];
    if (rowBlocks.length === 0) return { headers: [], rows: [], numericColumns: [] };

    const headerCells = matchAllCells(rowBlocks[0], HEADER_CELL_PATTERN);
    // First row's <th> cells if it has any, else fall back to treating its
    // <td> cells as headers (some manuscripts don't mark up a real <thead>).
    const headers = headerCells.length > 0 ? headerCells : matchAllCells(rowBlocks[0], DATA_CELL_PATTERN);
    const rows = rowBlocks
      .slice(1)
      .map((r) => matchAllCells(r, DATA_CELL_PATTERN))
      .filter((r) => r.length > 0);

    return { headers, rows, numericColumns: numericColumnsOf(rows) };
  }).filter((t) => t.headers.length > 0 || t.rows.length > 0);
}

/** True when a table has at least one numeric column and enough rows to
 * be worth charting (a single data point isn't a meaningful chart). */
export function isChartable(table: ExtractedTable): boolean {
  return table.numericColumns.length > 0 && table.rows.length >= 2;
}
