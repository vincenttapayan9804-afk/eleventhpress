/**
 * AI-generated accessibility captions for data tables — the table
 * counterpart to src/lib/alt-text.ts's figure alt-text. Tables live
 * inline as <table> blocks inside the galley HTML blob, so this locates
 * them with the same plain-regex convention already used by
 * src/lib/data-tables.ts (no DOM-parsing library is a dependency of this
 * project, and MANUSCRIPT_SANITIZE_OPTIONS already constrains table
 * markup to a small, predictable tag set).
 *
 * A generated caption is committed as a native <caption> element — the
 * correct semantic HTML for a table's title/summary, read aloud by screen
 * readers — inserted as the table's first child if it doesn't already
 * have one, or replacing an existing one.
 *
 * A generated suggestion is never auto-applied: runTableAccessibilityJob()
 * only stores results for editor review; a separate
 * applyTableAccessibilityResults() call commits reviewed captions into the
 * live galley HTML. Mirrors alt-text.ts's rule that unreviewed LLM output
 * never silently overwrites a production artifact.
 */
import { db } from "@/lib/db";
import { getObject, putObject } from "@/lib/storage";
import { chatJSON, anyLLMAvailable } from "@/lib/llm";

export interface ExtractedTableBlock {
  /** Position among all <table> blocks in the document, 0-based. */
  index: number;
  html: string;
  existingCaption: string;
}

export interface TableAccessibilitySuggestion {
  index: number;
  existingCaption: string;
  suggestedCaption: string;
  mode: "llm" | "heuristic";
}

const TABLE_PATTERN = /<table\b[^>]*>[\s\S]*?<\/table>/gi;
const CAPTION_PATTERN = /<caption\b[^>]*>([\s\S]*?)<\/caption>/i;

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Pulls every <table> block out of a galley HTML string, along with its
 * position and any existing <caption> text. */
export function extractTableBlocks(html: string): ExtractedTableBlock[] {
  const blocks = html.match(TABLE_PATTERN) || [];
  return blocks.map((block, index) => ({
    index,
    html: block,
    existingCaption: block.match(CAPTION_PATTERN)?.[1]?.trim() ?? "",
  }));
}

const TABLE_CAPTION_SYSTEM_PROMPT =
  "You write concise, screen-reader-appropriate captions for data tables in academic articles. Describe what the table shows — what's being compared, the key variables — in one plain sentence. Never speculate about conclusions the data doesn't state. Do not begin with \"Table showing\" or \"This table\".";

async function describeTable(
  tableHtml: string,
  articleTitle: string
): Promise<{ caption: string; model: string } | null> {
  if (!anyLLMAvailable()) return null;
  try {
    const plainText = stripTags(tableHtml).slice(0, 2000);
    const { data, model } = await chatJSON<{ caption: string }>(
      TABLE_CAPTION_SYSTEM_PROMPT,
      `This table appears in an article titled "${articleTitle}". Its cell text, in reading order:\n${plainText}\n\nRespond with a single JSON object: {"caption": "<the one-sentence caption>"}`,
      { maxTokens: 150, priority: "cost-first" }
    );
    if (!data.caption?.trim()) return null;
    return { caption: data.caption.trim(), model };
  } catch (e) {
    console.error("[table-accessibility] LLM call failed:", e);
    return null;
  }
}

function heuristicCaption(existingCaption: string, index: number): string {
  return existingCaption || `Table ${index + 1}`;
}

/**
 * Runs a single TableAccessibilityJob to completion (or failure) — same
 * atomic-claim pattern as runAltTextJob (src/lib/alt-text.ts). Generates
 * one caption suggestion per table found in the article's galley HTML;
 * never writes to the galley itself (see applyTableAccessibilityResults
 * for that).
 */
export async function runTableAccessibilityJob(
  jobId: string,
  triggeredBy: string | null = null,
  claimFilter: Record<string, unknown> = {}
): Promise<void> {
  const claimed = await db.tableAccessibilityJob.updateMany({
    where: { id: jobId, ...claimFilter },
    data: { status: "PROCESSING", startedAt: new Date(), errorMessage: null },
  });
  if (claimed.count !== 1) return;

  const job = await db.tableAccessibilityJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const article = await db.article.findUnique({ where: { id: job.articleId } });
  if (!article) {
    await db.tableAccessibilityJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: "Article no longer exists", completedAt: new Date() },
    });
    return;
  }

  try {
    const galleyHtml = article.galleyHtmlKey ? await getObject(article.galleyHtmlKey) : null;
    if (!galleyHtml) throw new Error("Article has no galley HTML to scan for tables");

    const tables = extractTableBlocks(galleyHtml.toString("utf-8"));
    const suggestions: TableAccessibilitySuggestion[] = [];

    for (const table of tables) {
      const described = await describeTable(table.html, article.title);
      suggestions.push(
        described
          ? { index: table.index, existingCaption: table.existingCaption, suggestedCaption: described.caption, mode: "llm" }
          : {
              index: table.index,
              existingCaption: table.existingCaption,
              suggestedCaption: heuristicCaption(table.existingCaption, table.index),
              mode: "heuristic",
            }
      );
    }

    await db.tableAccessibilityJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        tablesFound: tables.length,
        tablesProcessed: suggestions.length,
        results: JSON.stringify(suggestions),
        completedAt: new Date(),
      },
    });

    await db.auditLog.create({
      data: {
        userId: triggeredBy,
        action: "TABLE_ACCESSIBILITY_GENERATED",
        entityType: "ARTICLE",
        entityId: article.id,
        articleId: article.id,
        metadata: JSON.stringify({ jobId, tablesFound: tables.length, trigger: triggeredBy ? "manual" : "system" }),
      },
    });
  } catch (e: any) {
    await db.tableAccessibilityJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: e.message, completedAt: new Date() },
    });
  }
}

/** Rewrites (or inserts) the <caption> of each <table> block whose
 * position matches an entry in `updates`, leaving every other table
 * untouched. */
export function applyTableCaptions(html: string, updates: { index: number; caption: string }[]): string {
  const byIndex = new Map(updates.map((u) => [u.index, u.caption]));
  let i = -1;
  return html.replace(TABLE_PATTERN, (block) => {
    i++;
    const caption = byIndex.get(i);
    if (caption === undefined) return block;
    const escaped = caption.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (CAPTION_PATTERN.test(block)) {
      return block.replace(CAPTION_PATTERN, `<caption>${escaped}</caption>`);
    }
    return block.replace(/^(<table\b[^>]*>)/i, `$1<caption>${escaped}</caption>`);
  });
}

/**
 * Commits editor-reviewed captions into the live galley HTML — the only
 * path that ever changes what's actually served. Re-fetches the current
 * galley HTML rather than trusting the job's stale snapshot, same as
 * applyAltTextResults.
 */
export async function applyTableAccessibilityResults(
  articleId: string,
  jobId: string,
  reviewedResults: { index: number; caption: string }[]
): Promise<void> {
  const article = await db.article.findUnique({ where: { id: articleId } });
  if (!article?.galleyHtmlKey) throw new Error("Article has no galley HTML");

  const galleyHtml = await getObject(article.galleyHtmlKey);
  if (!galleyHtml) throw new Error("Galley HTML not found in storage");

  const updated = applyTableCaptions(galleyHtml.toString("utf-8"), reviewedResults);
  await putObject(article.galleyHtmlKey, Buffer.from(updated, "utf-8"), "text/html");

  await db.tableAccessibilityJob.update({ where: { id: jobId }, data: { appliedAt: new Date() } });
}

/** Batch entry point for the cron sweep — mirrors sweepStuckAltTextJobs. */
export async function sweepStuckTableAccessibilityJobs(limit = 5, staleMinutes = 10): Promise<{ swept: number; jobIds: string[] }> {
  const staleCutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
  const stuck = await db.tableAccessibilityJob.findMany({
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
    await runTableAccessibilityJob(job.id, null, {
      OR: [{ status: "QUEUED" }, { status: "PROCESSING", startedAt: { lt: staleCutoff } }],
    });
  }

  return { swept: stuck.length, jobIds: stuck.map((j) => j.id) };
}
