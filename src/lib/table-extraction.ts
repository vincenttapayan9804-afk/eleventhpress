/**
 * Table/dataset extraction — turns each <table> block in an article's
 * galley HTML into structured, exportable data (column headers + row
 * values), the "AI & checks" tab's counterpart to table-accessibility.ts's
 * captions. Reuses extractTableBlocks() from that module rather than
 * re-scanning the galley HTML a second way.
 *
 * Two-tier honesty, but unlike most AI features here the *primary* tier
 * needs no LLM at all: columns/rows are parsed directly out of the
 * table's own <tr>/<th>/<td> markup (MANUSCRIPT_SANITIZE_OPTIONS already
 * constrains table markup to a small, predictable tag set — see
 * table-accessibility.ts's header comment), so they're always real,
 * literal data, never a guess. A one-sentence `notes` field is a genuine
 * LLM enhancement layered on top — summarizing what the table shows or
 * flagging an apparent anomaly — and follows the same real-or-nothing
 * contract as glossary.ts/related-explanation.ts: mode "llm" or
 * "unavailable", never a fabricated heuristic guess about data the model
 * never actually reasoned about.
 */
import { db } from "@/lib/db";
import { getObject } from "@/lib/storage";
import { chatJSON, anyLLMAvailable } from "@/lib/llm";
import { extractTableBlocks } from "@/lib/table-accessibility";

export interface ParsedTableData {
  columns: string[];
  rows: string[][];
}

export interface TableExtractionResult extends ParsedTableData {
  index: number;
  notes: string;
  notesMode: "llm" | "unavailable";
}

const ROW_PATTERN = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
const CELL_PATTERN = /<(t[hd])\b[^>]*>([\s\S]*?)<\/\1>/gi;

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function cellText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")).trim();
}

/**
 * Parses a single <table>...</table> block's rows/cells directly out of
 * its markup — no LLM involved, so this is always available and always
 * literal (never a fabricated guess). The first row is treated as the
 * header row (whether its cells are <th> or plain <td>, matching common
 * authoring practice), every subsequent row as data.
 */
export function parseTableData(tableHtml: string): ParsedTableData {
  const rowMatches = [...tableHtml.matchAll(ROW_PATTERN)];
  const rows: string[][] = [];
  for (const [, rowHtml] of rowMatches) {
    const cells = [...rowHtml.matchAll(CELL_PATTERN)].map(([, , cellHtml]) => cellText(cellHtml));
    if (cells.length > 0) rows.push(cells);
  }
  if (rows.length === 0) return { columns: [], rows: [] };
  const [columns, ...body] = rows;
  return { columns, rows: body };
}

const TABLE_NOTES_SYSTEM_PROMPT =
  "You summarize what a data table in an academic article shows, in one plain sentence. Note anything that looks like a genuine anomaly (an empty cell where a value is expected, an outlier row) only if clearly evident from the data itself. Never speculate about conclusions the data doesn't state.";

async function describeTableData(
  parsed: ParsedTableData,
  articleTitle: string
): Promise<{ notes: string; model: string } | null> {
  if (!anyLLMAvailable() || parsed.rows.length === 0) return null;
  try {
    const preview = [parsed.columns, ...parsed.rows.slice(0, 15)].map((r) => r.join(" | ")).join("\n");
    const { data, model } = await chatJSON<{ notes: string }>(
      TABLE_NOTES_SYSTEM_PROMPT,
      `This table appears in an article titled "${articleTitle}". Its parsed contents (header row first):\n${preview}\n\nRespond with a single JSON object: {"notes": "<the one-sentence summary>"}`,
      { maxTokens: 150, priority: "cost-first" }
    );
    if (!data.notes?.trim()) return null;
    return { notes: data.notes.trim(), model };
  } catch (e) {
    console.error("[table-extraction] LLM call failed:", e);
    return null;
  }
}

/**
 * Runs a single TableExtractionJob to completion (or failure) — same
 * atomic-claim pattern as runTableAccessibilityJob.
 */
export async function runTableExtractionJob(
  jobId: string,
  triggeredBy: string | null = null,
  claimFilter: Record<string, unknown> = {}
): Promise<void> {
  const claimed = await db.tableExtractionJob.updateMany({
    where: { id: jobId, ...claimFilter },
    data: { status: "PROCESSING", startedAt: new Date(), errorMessage: null },
  });
  if (claimed.count !== 1) return;

  const job = await db.tableExtractionJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const article = await db.article.findUnique({ where: { id: job.articleId } });
  if (!article) {
    await db.tableExtractionJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: "Article no longer exists", completedAt: new Date() },
    });
    return;
  }

  try {
    const galleyHtml = article.galleyHtmlKey ? await getObject(article.galleyHtmlKey) : null;
    if (!galleyHtml) throw new Error("Article has no galley HTML to scan for tables");

    const tables = extractTableBlocks(galleyHtml.toString("utf-8"));
    const results: TableExtractionResult[] = [];

    for (const table of tables) {
      const parsed = parseTableData(table.html);
      const described = await describeTableData(parsed, article.title);
      results.push({
        index: table.index,
        columns: parsed.columns,
        rows: parsed.rows,
        notes: described?.notes ?? "",
        notesMode: described ? "llm" : "unavailable",
      });
    }

    await db.tableExtractionJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        tablesFound: tables.length,
        tablesProcessed: results.length,
        results: JSON.stringify(results),
        completedAt: new Date(),
      },
    });

    await db.auditLog.create({
      data: {
        userId: triggeredBy,
        action: "TABLE_EXTRACTION_GENERATED",
        entityType: "ARTICLE",
        entityId: article.id,
        articleId: article.id,
        metadata: JSON.stringify({ jobId, tablesFound: tables.length, trigger: triggeredBy ? "manual" : "system" }),
      },
    });
  } catch (e: any) {
    await db.tableExtractionJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: e.message, completedAt: new Date() },
    });
  }
}

/** Batch entry point for a future cron sweep — mirrors
 * sweepStuckTableAccessibilityJobs, currently unregistered in vercel.json
 * for the same Hobby-tier cron-count reason that one is. */
export async function sweepStuckTableExtractionJobs(limit = 5, staleMinutes = 10): Promise<{ swept: number; jobIds: string[] }> {
  const staleCutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
  const stuck = await db.tableExtractionJob.findMany({
    where: {
      OR: [
        { status: "QUEUED" },
        { status: "PROCESSING", startedAt: { lt: staleCutoff } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  for (const job of stuck) {
    await runTableExtractionJob(job.id, null, {
      OR: [{ status: "QUEUED" }, { status: "PROCESSING", startedAt: { lt: staleCutoff } }],
    });
  }

  return { swept: stuck.length, jobIds: stuck.map((j) => j.id) };
}
