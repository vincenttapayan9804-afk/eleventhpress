/**
 * Retraction Watch Database integration — checks an article's cited
 * references (Reference.doi, already resolved via OpenAlex) against real
 * retraction records, so a citation to a since-retracted paper is flagged
 * rather than silently missed.
 *
 * The data source is Crossref's own free, public mirror of the Retraction
 * Watch Database (a CSV, no API key, no per-request cost —
 * https://gitlab.com/crossref/retraction-watch-data), synced into
 * RetractionWatchRecord on an admin-triggered schedule (there's no
 * incremental/webhook feed, so this is a full re-sync each time, same
 * "batch job, not a live per-request call" shape as scripts/refresh-
 * citation-metrics.ts). RetractionWatchSyncMeta tracks whether a sync has
 * ever succeeded, so "0 retractions found" and "never synced, can't tell
 * you anything yet" are never conflated — the honesty contract every
 * check in this codebase follows.
 */
import { db } from "@/lib/db";

const DEFAULT_CSV_URL = "https://gitlab.com/crossref/retraction-watch-data/-/raw/main/retraction_watch.csv";
const BATCH_SIZE = 2000;

interface RetractionWatchRow {
  Title?: string;
  Journal?: string;
  RetractionDate?: string;
  RetractionDOI?: string;
  OriginalPaperDOI?: string;
  Reason?: string;
}

function firstDoi(raw: string | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(";").map((s) => s.trim()).find(Boolean);
  return first || null;
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

export interface RetractionWatchSyncResult {
  success: boolean;
  recordCount: number;
  error: string | null;
}

/**
 * Fetches the real Retraction Watch CSV and replaces the local mirror
 * table wholesale (there's no per-row "last modified" field to diff
 * against). Fails open with a real, disclosed error — never leaves the
 * table silently stale without recording that the last attempt failed.
 */
export async function syncRetractionWatchDatabase(): Promise<RetractionWatchSyncResult> {
  const url = process.env.RETRACTION_WATCH_CSV_URL || DEFAULT_CSV_URL;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);
    const csvText = await res.text();

    const XLSX = await import("xlsx");
    const workbook = XLSX.read(csvText, { type: "string" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<RetractionWatchRow>(sheet, { raw: false });

    const records = rows
      .map((row) => {
        const originalPaperDoi = firstDoi(row.OriginalPaperDOI);
        if (!originalPaperDoi) return null;
        return {
          originalPaperDoi: originalPaperDoi.toLowerCase(),
          originalTitle: row.Title || null,
          journal: row.Journal || null,
          retractionDoi: firstDoi(row.RetractionDOI),
          retractionDate: parseDate(row.RetractionDate),
          reason: row.Reason || null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    // Dedupe by DOI (the source data has occasional repeats) so the
    // @@unique constraint doesn't reject a batch mid-insert.
    const byDoi = new Map(records.map((r) => [r.originalPaperDoi, r]));
    const deduped = Array.from(byDoi.values());

    await db.retractionWatchRecord.deleteMany({});
    for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
      await db.retractionWatchRecord.createMany({ data: deduped.slice(i, i + BATCH_SIZE) });
    }

    await db.retractionWatchSyncMeta.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", lastSyncedAt: new Date(), recordCount: deduped.length, lastError: null },
      update: { lastSyncedAt: new Date(), recordCount: deduped.length, lastError: null },
    });

    return { success: true, recordCount: deduped.length, error: null };
  } catch (e: any) {
    await db.retractionWatchSyncMeta.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", lastError: e.message },
      update: { lastError: e.message },
    });
    return { success: false, recordCount: 0, error: e.message };
  }
}

export interface FlaggedReference {
  referenceId: string;
  rawText: string;
  doi: string;
  originalTitle: string | null;
  journal: string | null;
  retractionDate: Date | null;
  reason: string | null;
}

/**
 * Cross-references an article's already-resolved citations against the
 * local Retraction Watch mirror. `everSynced: false` means the table has
 * never been populated — the honest "can't tell you anything yet" case,
 * distinct from a real, checked, clean 0-flagged result.
 */
export async function checkReferencesForRetractions(
  articleId: string
): Promise<{ everSynced: boolean; syncedAt: Date | null; flagged: FlaggedReference[] }> {
  const meta = await db.retractionWatchSyncMeta.findUnique({ where: { id: "singleton" } });
  if (!meta || !meta.lastSyncedAt) {
    return { everSynced: false, syncedAt: null, flagged: [] };
  }

  const references = await db.reference.findMany({
    where: { articleId, doi: { not: null } },
    select: { id: true, rawText: true, doi: true },
  });
  if (references.length === 0) {
    return { everSynced: true, syncedAt: meta.lastSyncedAt, flagged: [] };
  }

  const dois = references.map((r) => r.doi!.toLowerCase());
  const matches = await db.retractionWatchRecord.findMany({ where: { originalPaperDoi: { in: dois } } });
  const matchByDoi = new Map(matches.map((m) => [m.originalPaperDoi, m]));

  const flagged: FlaggedReference[] = references
    .map((r) => {
      const match = matchByDoi.get(r.doi!.toLowerCase());
      if (!match) return null;
      return {
        referenceId: r.id,
        rawText: r.rawText,
        doi: r.doi!,
        originalTitle: match.originalTitle,
        journal: match.journal,
        retractionDate: match.retractionDate,
        reason: match.reason,
      };
    })
    .filter((f): f is FlaggedReference => f !== null);

  return { everSynced: true, syncedAt: meta.lastSyncedAt, flagged };
}
