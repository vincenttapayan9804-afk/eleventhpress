/**
 * RAG chunk embeddings for the "Ask this paper" chat feature
 * (src/app/api/articles/[id]/chat/route.ts).
 *
 * Splits a published article's full galley text into passages and embeds
 * each one with a real, free, open-source sentence-embedding model
 * (@xenova/transformers running Xenova/all-MiniLM-L6-v2 locally — no
 * external embedding API, no per-request cost, no vendor lock-in; the
 * Anthropic API has no embeddings endpoint, see src/lib/embeddings.ts).
 * The model and its weights are fetched once per warm serverless instance
 * and cached in module scope — same amortization pattern as
 * pgvectorReadyPromise (pgvector.ts) and the Anthropic client singleton
 * (llm.ts).
 *
 * If the model can't load for any reason (no egress to the model's CDN
 * from this instance, memory-constrained cold start, etc.) this fails
 * open to the same deterministic hashed n-gram scheme src/lib/
 * embeddings.ts uses for whole-article embeddings — never a thrown
 * error, never fabricated relevance. Every embedding records which mode
 * produced it (ArticleChunk.embeddingMode), and retrieveChunks() only
 * ever compares embeddings written in the same mode against each other,
 * since a hash vector and a real sentence-embedding vector do not share
 * a semantic space even at the same dimensionality.
 */
import { db } from "@/lib/db";
import sanitizeHtml from "sanitize-html";
import { getObject } from "@/lib/storage";
import { hashEmbedding } from "@/lib/embeddings";
import { cosineSimilarity } from "@/lib/vector-math";
import {
  ensureChunkVectorTable,
  upsertChunkVector,
  deleteChunkVectors,
  chunkVectorSearch,
  chunkVectorSearchCorpus,
} from "@/lib/pgvector";

export const CHUNK_EMBEDDING_DIMS = 384;
const CHUNK_TARGET_CHARS = 800;
const CHUNK_OVERLAP_CHARS = 120;
const LOCAL_MODEL_ID = "Xenova/all-MiniLM-L6-v2";

export type EmbeddingMode = "local-model" | "hash-fallback";

let extractorPromise: Promise<any | null> | null = null;

/**
 * Lazily loads the local embedding model once per warm instance. Resolves
 * null (never throws) if it can't load — e.g. this compute environment has
 * no egress to the Hugging Face CDN that serves the model weights — so
 * every caller always has a working fallback path.
 */
function getExtractor(): Promise<any | null> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      try {
        const { pipeline } = await import("@xenova/transformers");
        return await pipeline("feature-extraction", LOCAL_MODEL_ID);
      } catch (e) {
        console.error(
          "[chunk-embeddings] local embedding model failed to load, falling back to hashed n-grams:",
          e
        );
        return null;
      }
    })();
  }
  return extractorPromise;
}

/** Test-only: clears the cached model-load promise. */
export function __resetExtractorCacheForTests(): void {
  extractorPromise = null;
}

export interface ChunkEmbeddingResult {
  vector: number[];
  mode: EmbeddingMode;
}

/**
 * Embeds one piece of text — the real local model if it loaded
 * successfully in this instance, otherwise the deterministic hash
 * fallback. Always returns a CHUNK_EMBEDDING_DIMS-length vector either way.
 */
export async function generateChunkEmbedding(text: string): Promise<ChunkEmbeddingResult> {
  const extractor = await getExtractor();
  if (extractor) {
    try {
      const output = await extractor(text, { pooling: "mean", normalize: true });
      const vector = Array.from(output.data as Float32Array) as number[];
      if (vector.length === CHUNK_EMBEDDING_DIMS) {
        return { vector, mode: "local-model" };
      }
      console.error(
        `[chunk-embeddings] unexpected embedding dimensionality ${vector.length}, expected ${CHUNK_EMBEDDING_DIMS} — falling back to hash`
      );
    } catch (e) {
      console.error("[chunk-embeddings] local model inference failed, falling back to hashed n-grams:", e);
    }
  }
  return { vector: hashEmbedding(text, CHUNK_EMBEDDING_DIMS), mode: "hash-fallback" };
}

export function htmlToPlainText(html: string): string {
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Splits plain text into overlapping ~800-character passages, preferring
 * to break on a sentence boundary near the target length so a chunk
 * doesn't end mid-sentence.
 */
export function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + CHUNK_TARGET_CHARS, clean.length);
    if (end < clean.length) {
      const windowStart = Math.max(start, end - 150);
      const lastPeriod = clean.slice(windowStart, end).lastIndexOf(". ");
      if (lastPeriod !== -1) {
        end = windowStart + lastPeriod + 1;
      }
    }
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    start = Math.max(end - CHUNK_OVERLAP_CHARS, start + 1);
  }
  return chunks;
}

export interface IndexArticleChunksResult {
  chunkCount: number;
  mode: EmbeddingMode | "empty";
}

/**
 * (Re)chunks and (re)embeds an article's title + abstract + full galley
 * text. Deletes any previously-indexed chunks first, so this is safe to
 * call again after a galley regeneration. Called from the publish
 * workflow (fire-and-forget, same pattern as indexArticle() in
 * embeddings.ts) and from scripts/backfill-galleys.ts for already-
 * published articles.
 */
export async function indexArticleChunks(articleId: string): Promise<IndexArticleChunksResult> {
  const article = await db.article.findUnique({
    where: { id: articleId },
    select: { galleyHtmlKey: true, title: true, abstract: true },
  });
  if (!article) return { chunkCount: 0, mode: "empty" };

  let bodyText = "";
  if (article.galleyHtmlKey) {
    const bytes = await getObject(article.galleyHtmlKey);
    if (bytes) bodyText = htmlToPlainText(bytes.toString("utf-8"));
  }
  // Lead with title + abstract so a question about the paper's overall
  // claim/contribution is answerable even from the very first chunk.
  const fullText = [article.title, article.abstract, bodyText].filter(Boolean).join("\n\n");
  const passages = chunkText(fullText);

  await db.articleChunk.deleteMany({ where: { articleId } });
  if (await ensureChunkVectorTable()) {
    await deleteChunkVectors(articleId).catch(() => {});
  }

  if (passages.length === 0) return { chunkCount: 0, mode: "empty" };

  let mode: EmbeddingMode = "hash-fallback";
  for (let i = 0; i < passages.length; i++) {
    const embedded = await generateChunkEmbedding(passages[i]);
    mode = embedded.mode;
    const row = await db.articleChunk.create({
      data: {
        articleId,
        chunkIndex: i,
        text: passages[i],
        embedding: JSON.stringify(embedded.vector),
        embeddingDims: embedded.vector.length,
        embeddingMode: embedded.mode,
      },
    });
    if (await ensureChunkVectorTable()) {
      try {
        await upsertChunkVector(row.id, articleId, embedded.vector);
      } catch (e) {
        console.error(
          `[chunk-embeddings] pgvector upsert failed for chunk ${row.id}, JSON column already written:`,
          e
        );
      }
    }
  }
  return { chunkCount: passages.length, mode };
}

export interface RetrievedChunk {
  chunkId: string;
  text: string;
  chunkIndex: number;
  score: number;
  matchType: "vector" | "lexical";
}

/**
 * Retrieves the top-`limit` passages of `articleId` most relevant to
 * `query`. Vector comparison only ever happens between embeddings written
 * in the same mode (see file header). Any shortfall against `limit` — the
 * article has no same-mode chunks at all, or fewer than `limit` score
 * above zero — is backfilled with simple case-insensitive term-overlap
 * scoring over the remaining chunks, so a chat question never comes back
 * empty just because the model's availability flipped between indexing
 * and query time.
 */
export async function retrieveChunks(
  articleId: string,
  query: string,
  limit = 6
): Promise<RetrievedChunk[]> {
  const allChunks = await db.articleChunk.findMany({
    where: { articleId },
    orderBy: { chunkIndex: "asc" },
  });
  if (allChunks.length === 0) return [];

  const { vector: queryVector, mode: queryMode } = await generateChunkEmbedding(query);
  const sameModeChunks = allChunks.filter(
    (c) => c.embeddingMode === queryMode && c.embeddingDims === queryVector.length
  );

  const results: RetrievedChunk[] = [];

  if (sameModeChunks.length > 0) {
    let usedIndex = false;
    if (await ensureChunkVectorTable()) {
      try {
        const rows = await chunkVectorSearch(articleId, queryVector, limit);
        const byId = new Map(allChunks.map((c) => [c.id, c]));
        for (const r of rows) {
          const c = byId.get(r.chunkId);
          if (c && c.embeddingMode === queryMode) {
            results.push({ chunkId: c.id, text: c.text, chunkIndex: c.chunkIndex, score: r.score, matchType: "vector" });
          }
        }
        usedIndex = true;
      } catch (e) {
        console.error("[chunk-embeddings] pgvector chunk search failed, falling back to in-memory scan:", e);
      }
    }
    if (!usedIndex || results.length === 0) {
      const scored = sameModeChunks
        .map((c) => ({ c, score: cosineSimilarity(queryVector, JSON.parse(c.embedding) as number[]) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      for (const { c, score } of scored) {
        results.push({ chunkId: c.id, text: c.text, chunkIndex: c.chunkIndex, score, matchType: "vector" });
      }
    }
  }

  if (results.length >= limit) return results;

  const already = new Set(results.map((r) => r.chunkId));
  const terms = query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  const lexicalScored = allChunks
    .filter((c) => !already.has(c.id))
    .map((c) => {
      const lower = c.text.toLowerCase();
      const score = terms.reduce((s, t) => s + (lower.includes(t) ? 1 : 0), 0);
      return { c, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit - results.length);

  for (const { c, score } of lexicalScored) {
    results.push({ chunkId: c.id, text: c.text, chunkIndex: c.chunkIndex, score, matchType: "lexical" });
  }

  return results;
}

export interface CorpusRetrievedChunk extends RetrievedChunk {
  articleId: string;
  articleTitle: string;
}

/**
 * Journal-wide counterpart to retrieveChunks() — searches every PUBLISHED
 * article's chunks at once instead of one article's, backing the
 * "Ask the Corpus" chat (src/app/api/corpus-chat/route.ts). Same
 * same-embedding-mode-only comparison and vector-then-lexical fallback
 * contract as retrieveChunks(); the only structural difference is the
 * corpus-wide scope and that each result also carries which article it
 * came from, since a corpus answer has to cite its source article.
 */
export async function retrieveChunksAcrossCorpus(
  query: string,
  limit = 8
): Promise<CorpusRetrievedChunk[]> {
  const { vector: queryVector, mode: queryMode } = await generateChunkEmbedding(query);
  const results: CorpusRetrievedChunk[] = [];

  if (await ensureChunkVectorTable()) {
    try {
      const rows = await chunkVectorSearchCorpus(queryVector, limit * 2);
      if (rows.length > 0) {
        const chunkRows = await db.articleChunk.findMany({
          where: { id: { in: rows.map((r) => r.chunkId) } },
          include: { article: { select: { title: true, status: true } } },
        });
        const byId = new Map(chunkRows.map((c) => [c.id, c]));
        for (const r of rows) {
          const c = byId.get(r.chunkId);
          if (c && c.embeddingMode === queryMode && c.article.status === "PUBLISHED") {
            results.push({
              chunkId: c.id,
              text: c.text,
              chunkIndex: c.chunkIndex,
              score: r.score,
              matchType: "vector",
              articleId: c.articleId,
              articleTitle: c.article.title,
            });
          }
          if (results.length >= limit) break;
        }
      }
    } catch (e) {
      console.error("[chunk-embeddings] corpus pgvector search failed, falling back to in-memory scan:", e);
    }
  }

  if (results.length === 0) {
    const allChunks = await db.articleChunk.findMany({
      where: { article: { status: "PUBLISHED" } },
      include: { article: { select: { title: true } } },
    });
    const sameModeChunks = allChunks.filter(
      (c) => c.embeddingMode === queryMode && c.embeddingDims === queryVector.length
    );
    const scored = sameModeChunks
      .map((c) => ({ c, score: cosineSimilarity(queryVector, JSON.parse(c.embedding) as number[]) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    for (const { c, score } of scored) {
      results.push({
        chunkId: c.id,
        text: c.text,
        chunkIndex: c.chunkIndex,
        score,
        matchType: "vector",
        articleId: c.articleId,
        articleTitle: c.article.title,
      });
    }
  }

  if (results.length >= limit) return results.slice(0, limit);

  const already = new Set(results.map((r) => r.chunkId));
  const terms = query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  const remainingChunks = await db.articleChunk.findMany({
    where: { article: { status: "PUBLISHED" }, id: { notIn: [...already] } },
    include: { article: { select: { title: true } } },
  });
  const lexicalScored = remainingChunks
    .map((c) => {
      const lower = c.text.toLowerCase();
      const score = terms.reduce((s, t) => s + (lower.includes(t) ? 1 : 0), 0);
      return { c, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit - results.length);

  for (const { c, score } of lexicalScored) {
    results.push({
      chunkId: c.id,
      text: c.text,
      chunkIndex: c.chunkIndex,
      score,
      matchType: "lexical",
      articleId: c.articleId,
      articleTitle: c.article.title,
    });
  }

  return results;
}
