/**
 * Semantic search service — generates vector embeddings for articles and
 * performs cosine-similarity search.
 *
 * The Anthropic API has no embeddings endpoint (Claude is a generation
 * model, not an embedding model), so this runs a real, free, open-source
 * sentence-embedding model locally: @xenova/transformers running
 * Xenova/all-MiniLM-L6-v2 (Apache-2.0, no external API, no per-request
 * cost) — the same model already proven in src/lib/chunk-embeddings.ts for
 * RAG passage retrieval. If the model can't load for any reason (no
 * egress to its CDN from this instance, memory-constrained cold start),
 * this fails open to the same deterministic hashed n-gram scheme used
 * before, at the same 384 dimensionality so the two modes are never
 * compared against each other — see generateEmbeddingWithMode() and
 * hashEmbedding() below. Every embedding records which mode produced it
 * (ArticleEmbedding.model), same honest-fallback contract as
 * chunk-embeddings.ts's ArticleChunk.embeddingMode.
 */
import { db } from "@/lib/db";
import crypto from "crypto";
import { cosineSimilarity } from "@/lib/vector-math";
import { ensurePgvector, upsertVector, vectorLiteral } from "@/lib/pgvector";

const EMBEDDING_DIMS = 384;
const LOCAL_MODEL_ID = "Xenova/all-MiniLM-L6-v2";

/** Exported so scripts/backfill-galleys.ts can find articles whose stored
 * ArticleEmbedding.model isn't this — i.e. still on the hash fallback from
 * before this model was wired in, or from a cold start that never got the
 * real model loaded — and re-embed them. */
export const REAL_EMBEDDING_MODEL_ID = LOCAL_MODEL_ID;

let extractorPromise: Promise<any | null> | null = null;

/** Lazily loads the local embedding model once per warm instance. Resolves
 * null (never throws) if it can't load — same fail-open contract as
 * chunk-embeddings.ts's getExtractor(). A second, independent load from
 * that module's own cache rather than a shared one — see this file's
 * header for why the two never compare vectors against each other anyway. */
function getExtractor(): Promise<any | null> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      try {
        const { pipeline } = await import("@xenova/transformers");
        return await pipeline("feature-extraction", LOCAL_MODEL_ID);
      } catch (e) {
        console.error("[embeddings] local embedding model failed to load, falling back to hashed n-grams:", e);
        return null;
      }
    })();
  }
  return extractorPromise;
}

/** Test-only: clears the cached model-load promise. */
export function __resetEmbeddingExtractorCacheForTests(): void {
  extractorPromise = null;
}

export type EmbeddingModelMode = "local-model" | "hash-fallback";

export interface GeneratedEmbedding {
  vector: number[];
  mode: EmbeddingModelMode;
  model: string;
}

/**
 * Generate an embedding vector for a piece of text (usually an article's
 * title + abstract + keywords), along with which mode produced it. Always
 * EMBEDDING_DIMS (384) dimensions either way.
 */
export async function generateEmbeddingWithMode(text: string): Promise<GeneratedEmbedding> {
  const extractor = await getExtractor();
  if (extractor) {
    try {
      const output = await extractor(text, { pooling: "mean", normalize: true });
      const vector = Array.from(output.data as Float32Array) as number[];
      if (vector.length === EMBEDDING_DIMS) {
        return { vector, mode: "local-model", model: LOCAL_MODEL_ID };
      }
      console.error(
        `[embeddings] unexpected embedding dimensionality ${vector.length}, expected ${EMBEDDING_DIMS} — falling back to hash`
      );
    } catch (e) {
      console.error("[embeddings] local model inference failed, falling back to hashed n-grams:", e);
    }
  }
  return { vector: hashEmbedding(text, EMBEDDING_DIMS), mode: "hash-fallback", model: "hashed-ngram-v1" };
}

/**
 * Generate an embedding vector for an article's title + abstract + keywords.
 * Returns a float array of EMBEDDING_DIMS dimensions. Thin wrapper around
 * generateEmbeddingWithMode() for the many callers that only need the
 * vector (two embeddings freshly generated within the same call are always
 * the same mode/dimensionality, so this is safe for any pairwise
 * comparison that doesn't touch a persisted embedding from before this
 * model existed — see indexArticle() for the one that does).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  return (await generateEmbeddingWithMode(text)).vector;
}

/**
 * Deterministic embedding: hashes overlapping n-grams of the text and uses
 * each hash to seed a dimension. Articles with similar vocabulary will
 * have vectors that cluster together. Exported so src/lib/chunk-embeddings.ts
 * can reuse the exact same scheme (at a different dimensionality) as its
 * fallback when the real open-source sentence-embedding model isn't available.
 */
export function hashEmbedding(text: string, dims: number): number[] {
  const vec = new Array(dims).fill(0);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const words = normalized.split(/\s+/).filter((w) => w.length > 2);

  // Unigram contributions
  for (const word of words) {
    const hash = crypto.createHash("md5").update(word).digest();
    for (let i = 0; i < dims; i++) {
      vec[i] += (hash[i % 16] / 255 - 0.5) * (1 / Math.sqrt(words.length));
    }
  }

  // Bigram contributions (stronger signal)
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = words[i] + " " + words[i + 1];
    const hash = crypto.createHash("md5").update(bigram).digest();
    for (let d = 0; d < dims; d++) {
      vec[d] += (hash[d % 16] / 255 - 0.5) * (1.5 / Math.sqrt(words.length));
    }
  }

  return normalize(vec);
}

function normalize(vec: number[]): number[] {
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / mag);
}

/**
 * Generate and store an embedding for an article.
 */
export async function indexArticle(articleId: string): Promise<void> {
  const article = await db.article.findUnique({
    where: { id: articleId },
    select: { title: true, abstract: true, keywords: true, discipline: true },
  });
  if (!article) return;

  const text = `${article.title}. ${article.abstract} ${article.keywords} ${article.discipline}`;
  const { vector, model } = await generateEmbeddingWithMode(text);
  const textHash = crypto.createHash("sha256").update(text).digest("hex");

  // Canonical write — the JSON column stays the source of truth and
  // automatic fallback regardless of pgvector availability. `model` records
  // which tier actually produced this vector (see file header) so
  // scripts/backfill-galleys.ts can find and re-embed any article still on
  // an older/lower-quality mode once a better one becomes available.
  await db.articleEmbedding.upsert({
    where: { articleId },
    create: {
      articleId,
      embedding: JSON.stringify(vector),
      textHash,
      model,
      dimensions: EMBEDDING_DIMS,
    },
    update: {
      embedding: JSON.stringify(vector),
      textHash,
      model,
      dimensions: EMBEDDING_DIMS,
      updatedAt: new Date(),
    },
  });

  // Opportunistic — the canonical write above has already landed, so a
  // failure here never loses data, it just means this article's indexed
  // similarity search stays on the JS fallback until the next reindex.
  if (await ensurePgvector()) {
    try {
      await upsertVector(articleId, vector);
    } catch (e) {
      console.error(`[embeddings] pgvector upsert failed for article ${articleId}, JSON column already written:`, e);
    }
  }
}

/**
 * Semantic search: find articles whose embeddings are closest to the query.
 * Returns article IDs ranked by cosine similarity.
 */
export async function semanticSearch(
  query: string,
  options: { limit?: number; threshold?: number } = {}
): Promise<{ articleId: string; score: number }[]> {
  const limit = options.limit ?? 20;
  const threshold = options.threshold ?? 0.1;

  const queryEmbedding = await generateEmbedding(query);

  if (await ensurePgvector()) {
    try {
      // ORDER BY ... LIMIT is index-backed (HNSW) regardless of corpus
      // size. Applying `threshold` to the already-limited/sorted rows in
      // JS below is equivalent to today's filter-then-sort-then-slice
      // (score is monotonic along the distance ordering) — don't move it
      // into the SQL WHERE clause, that would fight the HNSW index's
      // KNN-ordered access pattern.
      const literal = vectorLiteral(queryEmbedding);
      const rows = await db.$queryRaw<{ articleId: string; score: number }[]>`
        SELECT ve.article_id AS "articleId",
               1 - (ve.embedding <=> ${literal}::vector) AS score
        FROM vec.article_embedding_v384 ve
        JOIN public."Article" a ON a.id = ve.article_id
        WHERE a.status = 'PUBLISHED'
        ORDER BY ve.embedding <=> ${literal}::vector ASC
        LIMIT ${limit}
      `;
      return rows.filter((r) => r.score >= threshold);
    } catch (e) {
      console.error("[embeddings] pgvector semanticSearch failed, falling back to in-memory scan:", e);
    }
  }

  // Fallback: unbounded in-memory scan, unchanged from before pgvector.
  const allEmbeddings = await db.articleEmbedding.findMany({
    include: {
      article: {
        select: { id: true, status: true },
      },
    },
  });

  const results = allEmbeddings
    .filter((e) => e.article.status === "PUBLISHED")
    .map((e) => {
      const vec = JSON.parse(e.embedding) as number[];
      const score = cosineSimilarity(queryEmbedding, vec);
      return { articleId: e.articleId, score };
    })
    .filter((r) => r.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return results;
}
