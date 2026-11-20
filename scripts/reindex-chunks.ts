/**
 * Re-indexes published articles' Research Assistant passages with
 * section-aware splitting (src/lib/section-chunker.ts), so citations can
 * say "Methods › Sampling" or "Table 2" and section questions find the
 * right part of each paper. Also fills the full-text search table
 * (vec.article_chunk_text) used once a journal has many passages.
 *
 * By default only articles whose passages were all indexed before
 * section-aware splitting (no passage has a section or heading) are
 * re-indexed. Safe to re-run; each article is re-indexed in one pass.
 *
 * Usage:
 *   bun run scripts/reindex-chunks.ts                  # dry run: count what would change
 *   bun run scripts/reindex-chunks.ts --confirm        # re-index those articles
 *   bun run scripts/reindex-chunks.ts --confirm --all  # re-index every published article
 *   bun run scripts/reindex-chunks.ts --confirm --limit 50
 */
import { db } from "../src/lib/db";
import { indexArticleChunks } from "../src/lib/chunk-embeddings";
import { ensureChunkTextIndex } from "../src/lib/pgvector";

const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const all = args.includes("--all");
const limitArg = args.indexOf("--limit");
const limit = limitArg !== -1 ? Number(args[limitArg + 1]) : Infinity;

async function main() {
  const published = await db.article.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, title: true },
    orderBy: { publishedAt: "desc" },
  });
  let targets = published;
  if (!all) {
    const sectioned = new Set(
      (
        await db.articleChunk.groupBy({
          by: ["articleId"],
          where: { OR: [{ section: { not: null } }, { headingPath: { not: null } }, { kind: { not: "text" } }] },
        })
      ).map((r) => r.articleId)
    );
    targets = published.filter((a) => !sectioned.has(a.id));
  }
  if (Number.isFinite(limit) && limit > 0) targets = targets.slice(0, limit);

  console.log(`${published.length} published articles; ${targets.length} to re-index${all ? " (--all)" : " (not yet section-indexed)"}.`);
  if (!confirm) {
    console.log("Dry run. Pass --confirm to re-index.");
    return;
  }

  console.log(`Full-text index: ${(await ensureChunkTextIndex()) ? "ready" : "unavailable (search falls back to in-memory ranking)"}`);
  let ok = 0;
  let failed = 0;
  for (const [i, a] of targets.entries()) {
    try {
      const r = await indexArticleChunks(a.id);
      ok++;
      console.log(`[${i + 1}/${targets.length}] ${r.chunkCount} passages (${r.mode}) · ${a.title.slice(0, 70)}`);
    } catch (e) {
      failed++;
      console.error(`[${i + 1}/${targets.length}] FAILED ${a.id}:`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`Done: ${ok} re-indexed, ${failed} failed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
