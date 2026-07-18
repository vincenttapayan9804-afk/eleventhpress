/**
 * pgvector bootstrap + write-path infrastructure for indexed article
 * similarity search at scale.
 *
 * Deliberately isolated in its own Postgres schema (`vec`) that
 * prisma/schema.prisma never references — `prisma db push` diffs the
 * ENTIRE namespace the datasource connects to (default `public`), not just
 * objects it declared, so a raw-SQL-created column/table sharing a
 * namespace with Prisma-managed ones risks being flagged as drift and
 * dropped non-interactively on a later deploy (the build script's
 * `prisma db push` has no --accept-data-loss flag and runs with no TTY).
 * A namespace Prisma was never told about is permanently invisible to its
 * diffing, which sidesteps that failure mode entirely.
 *
 * Everything here is created lazily at runtime (first call per cold
 * serverless instance), never at build/deploy time, and fails open: any
 * error anywhere in this file is caught, logged, and results in
 * ensurePgvector() resolving false — every caller (embeddings.ts,
 * manuscript-checks.ts) falls back to its pre-existing, unmodified
 * in-memory JS scan when that happens. Zero deploy risk, zero regression
 * risk; pgvector is a pure opportunistic upgrade layered on top.
 */
import { db } from "@/lib/db";

const EMBEDDING_DIMS = 256;

let pgvectorReadyPromise: Promise<boolean> | null = null;

/**
 * Ensures the `vec` schema, table, extension, and HNSW index exist.
 * Cached per-process (module-level promise) so concurrent/repeated calls
 * within the same serverless instance never race or repeat the DDL.
 * Resolves false (never throws) if pgvector isn't usable for any reason.
 */
export function ensurePgvector(): Promise<boolean> {
  if (!pgvectorReadyPromise) {
    pgvectorReadyPromise = bootstrap().catch((e) => {
      console.error("[pgvector] bootstrap failed, falling back to in-memory similarity search:", e);
      return false;
    });
  }
  return pgvectorReadyPromise;
}

async function bootstrap(): Promise<boolean> {
  const alreadyReady = await checkExists();
  if (!alreadyReady) {
    await db.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS vec`);
    await db.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);
    await db.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS vec.article_embedding (
         article_id TEXT PRIMARY KEY,
         embedding vector(${EMBEDDING_DIMS}) NOT NULL,
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`
    );
    await db.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS article_embedding_hnsw_idx
         ON vec.article_embedding USING hnsw (embedding vector_cosine_ops)`
    );
  }
  await backfillFromJsonColumn();
  return true;
}

/** Cheap existence check — a single catalog lookup, avoids running four
 * CREATE...IF NOT EXISTS statements on every cold start once bootstrap has
 * already succeeded once against this database. */
async function checkExists(): Promise<boolean> {
  const rows = await db.$queryRaw<{ ready: boolean }[]>`
    SELECT
      EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')
      AND EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'vec' AND table_name = 'article_embedding'
      )
      AND EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'vec' AND indexname = 'article_embedding_hnsw_idx'
      ) AS ready
  `;
  return rows[0]?.ready === true;
}

/**
 * Backfills vec.article_embedding from the canonical
 * public."ArticleEmbedding".embedding JSON column, bounded to 500 rows per
 * call so this degrades gracefully (a few extra cold starts to finish)
 * rather than risking a timeout if the corpus has grown by deploy time.
 * At the current sub-dozen-article corpus this clears in one pass.
 */
async function backfillFromJsonColumn(): Promise<void> {
  const missing = await db.$queryRaw<{ articleId: string; embedding: string }[]>`
    SELECT ae."articleId" AS "articleId", ae.embedding
    FROM public."ArticleEmbedding" ae
    LEFT JOIN vec.article_embedding ve ON ve.article_id = ae."articleId"
    WHERE ve.article_id IS NULL
    LIMIT 500
  `;
  for (const row of missing) {
    try {
      const vec = JSON.parse(row.embedding) as number[];
      if (!Array.isArray(vec) || vec.length !== EMBEDDING_DIMS) continue;
      await upsertVector(row.articleId, vec);
    } catch (e) {
      console.error(`[pgvector] backfill failed for article ${row.articleId}, skipping:`, e);
    }
  }
}

/** pgvector's expected text input format for a vector literal, e.g. "[0.1,-0.2,0.3]". */
export function vectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

/** Upserts a single article's vector into vec.article_embedding. */
export async function upsertVector(articleId: string, vec: number[]): Promise<void> {
  await db.$executeRaw`
    INSERT INTO vec.article_embedding (article_id, embedding, updated_at)
    VALUES (${articleId}, ${vectorLiteral(vec)}::vector, now())
    ON CONFLICT (article_id) DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = now()
  `;
}

/** Row count in vec.article_embedding — diagnostic use only (status endpoint). */
export async function pgvectorRowCount(): Promise<number> {
  const rows = await db.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) AS count FROM vec.article_embedding`;
  return Number(rows[0]?.count ?? 0);
}

/** Test-only: clears the cached bootstrap promise so a single test file can
 * exercise both the success and failure paths of ensurePgvector(). */
export function __resetPgvectorCacheForTests(): void {
  pgvectorReadyPromise = null;
}

// ---------------------------------------------------------------------------
// Chunk-level vector table — same schema/fail-open design as
// article_embedding above, sized for the RAG chat feature's passage
// embeddings (src/lib/chunk-embeddings.ts) instead of whole-article
// title+abstract embeddings. Separate table because the dimensionality
// differs (384 vs 256) and retrieval is always scoped to one article's
// rows, never a corpus-wide scan.
// ---------------------------------------------------------------------------

const CHUNK_EMBEDDING_DIMS = 384;

let chunkVectorReadyPromise: Promise<boolean> | null = null;

/** Ensures the `vec.article_chunk_embedding` table + HNSW index exist. Same
 * cached-promise, fail-open contract as ensurePgvector(). */
export function ensureChunkVectorTable(): Promise<boolean> {
  if (!chunkVectorReadyPromise) {
    chunkVectorReadyPromise = bootstrapChunkTable().catch((e) => {
      console.error("[pgvector] chunk table bootstrap failed, falling back to in-memory chunk search:", e);
      return false;
    });
  }
  return chunkVectorReadyPromise;
}

async function bootstrapChunkTable(): Promise<boolean> {
  // Reuses the same `vec` schema + `vector` extension ensurePgvector()
  // already creates — safe to call redundantly, it's idempotent and cached.
  await ensurePgvector();
  await db.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS vec`);
  await db.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);
  await db.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS vec.article_chunk_embedding (
       chunk_id   TEXT PRIMARY KEY,
       article_id TEXT NOT NULL,
       embedding  vector(${CHUNK_EMBEDDING_DIMS}) NOT NULL,
       updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS article_chunk_embedding_article_idx
       ON vec.article_chunk_embedding (article_id)`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS article_chunk_embedding_hnsw_idx
       ON vec.article_chunk_embedding USING hnsw (embedding vector_cosine_ops)`
  );
  return true;
}

/** Upserts a single chunk's vector. */
export async function upsertChunkVector(chunkId: string, articleId: string, vec: number[]): Promise<void> {
  await db.$executeRaw`
    INSERT INTO vec.article_chunk_embedding (chunk_id, article_id, embedding, updated_at)
    VALUES (${chunkId}, ${articleId}, ${vectorLiteral(vec)}::vector, now())
    ON CONFLICT (chunk_id) DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = now()
  `;
}

/** Deletes every vector for an article (used when chunks are regenerated). */
export async function deleteChunkVectors(articleId: string): Promise<void> {
  await db.$executeRaw`DELETE FROM vec.article_chunk_embedding WHERE article_id = ${articleId}`;
}

/** Cosine-ranked chunk search scoped to a single article — small per-article
 * corpus (dozens of chunks), so this stays index-backed via HNSW but never
 * risks the "unbounded scan" concern the article-level fallback has. */
export async function chunkVectorSearch(
  articleId: string,
  queryVec: number[],
  limit: number
): Promise<{ chunkId: string; score: number }[]> {
  const literal = vectorLiteral(queryVec);
  return db.$queryRaw<{ chunkId: string; score: number }[]>`
    SELECT chunk_id AS "chunkId", 1 - (embedding <=> ${literal}::vector) AS score
    FROM vec.article_chunk_embedding
    WHERE article_id = ${articleId}
    ORDER BY embedding <=> ${literal}::vector ASC
    LIMIT ${limit}
  `;
}

/** Test-only: mirrors __resetPgvectorCacheForTests() for the chunk table. */
export function __resetChunkVectorCacheForTests(): void {
  chunkVectorReadyPromise = null;
}
