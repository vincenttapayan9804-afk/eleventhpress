import { db } from "@/lib/db";
import { indexArticleChunks } from "@/lib/chunk-embeddings";

/**
 * Brings published articles' Research Assistant passages up to the current
 * splitter (src/lib/section-chunker.ts) without anyone running
 * scripts/reindex-chunks.ts by hand: the daily sweep (api/cron/sweep-all)
 * re-indexes, a batch at a time, every article whose passages were written
 * before CHUNKER_UPDATED_AT. Re-indexing replaces all of an article's
 * passages, so once done an article is no longer "stale" and the sweep
 * becomes a single cheap query.
 *
 * Move CHUNKER_UPDATED_AT forward whenever the splitter changes what it
 * writes (sections in Phase 2, equations in Phase 4).
 */
export const CHUNKER_UPDATED_AT = new Date("2026-11-20T17:00:00Z");

interface Deps {
  findStale: (cutoff: Date, take: number) => Promise<{ id: string }[]>;
  index: (articleId: string) => Promise<unknown>;
}

export function staleArticlesWhere(cutoff: Date) {
  return { status: "PUBLISHED" as const, chunks: { some: { createdAt: { lt: cutoff } } } };
}

const DEFAULT_DEPS: Deps = {
  findStale: (cutoff, take) =>
    db.article.findMany({ where: staleArticlesWhere(cutoff), select: { id: true }, orderBy: { publishedAt: "desc" }, take }),
  index: (articleId) => indexArticleChunks(articleId),
};

export async function reindexStaleChunks(opts: { budgetMs?: number; max?: number; cutoff?: Date } = {}, deps: Deps = DEFAULT_DEPS) {
  const budgetMs = opts.budgetMs ?? 120_000;
  const cutoff = opts.cutoff ?? CHUNKER_UPDATED_AT;
  const started = Date.now();
  const stale = await deps.findStale(cutoff, opts.max ?? 200);
  let reindexed = 0;
  let failed = 0;
  for (const a of stale) {
    if (Date.now() - started > budgetMs) break;
    try {
      await deps.index(a.id);
      reindexed++;
    } catch (e) {
      failed++;
      console.error(`[chunk-reindex] ${a.id}:`, e instanceof Error ? e.message : e);
    }
  }
  return { stale: stale.length, reindexed, failed, remaining: stale.length - reindexed };
}
