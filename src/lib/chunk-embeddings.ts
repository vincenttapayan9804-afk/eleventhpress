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
import { loadTransformers } from "@/lib/transformers-runtime";
import { db } from "@/lib/db";
import sanitizeHtml from "sanitize-html";
import { getObject } from "@/lib/storage";
import { hashEmbedding } from "@/lib/embeddings";
import { cosineSimilarity } from "@/lib/vector-math";
import { ensureChunkVectorTable, upsertChunkVector, deleteChunkVectors } from "@/lib/pgvector";
import { Bm25Index, tokenize, titleMatch, isFocusedMatch, titleDocumentFrequency } from "@/lib/lexical-search";

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
        const { pipeline } = await loadTransformers();
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

/** Reciprocal-rank-fusion constant (the usual value from the RRF paper). */
const RRF_K = 60;

/** Weight of the vector signal in the fused ranking. The real sentence
 * model is a strong semantic signal; the hashed n-gram fallback only
 * measures surface overlap, which BM25 already does better, so it's
 * reduced to a tie-breaker. */
function vectorWeight(mode: EmbeddingMode): number {
  return mode === "local-model" ? 1 : 0.35;
}

interface Scored {
  lexical: number;
  vector: number | null;
}

/** 1-based rank of each entry among entries with a positive value. */
function ranksOf(values: (number | null)[]): (number | null)[] {
  const order = values
    .map((v, i) => ({ v, i }))
    .filter((e): e is { v: number; i: number } => e.v !== null && e.v > 0)
    .sort((a, b) => b.v - a.v);
  const ranks: (number | null)[] = values.map(() => null);
  order.forEach((e, r) => (ranks[e.i] = r + 1));
  return ranks;
}

/** Fuses BM25 and vector rankings with reciprocal rank fusion. */
function fuse(scored: Scored[], mode: EmbeddingMode): { fused: number[]; lexRanks: (number | null)[]; vecRanks: (number | null)[] } {
  const lexRanks = ranksOf(scored.map((s) => s.lexical));
  const vecRanks = ranksOf(scored.map((s) => s.vector));
  const w = vectorWeight(mode);
  const fused = scored.map((_, i) => {
    const lr = lexRanks[i];
    const vr = vecRanks[i];
    return (lr ? 1 / (RRF_K + lr) : 0) + (vr ? w / (RRF_K + vr) : 0);
  });
  return { fused, lexRanks, vecRanks };
}

function sameModeVector(
  c: { embedding: string; embeddingDims: number; embeddingMode: string },
  queryVector: number[],
  queryMode: EmbeddingMode
): number | null {
  if (c.embeddingMode !== queryMode || c.embeddingDims !== queryVector.length) return null;
  try {
    return cosineSimilarity(queryVector, JSON.parse(c.embedding) as number[]);
  } catch {
    return null;
  }
}

/**
 * Retrieves the top-`limit` passages of `articleId` most relevant to
 * `query`, for "Ask this paper".
 *
 * Hybrid retrieval: BM25 keyword relevance (lexical-search.ts) fused with
 * vector similarity. Vectors are only compared within the same embedding
 * mode (see file header). If nothing in the article matches the question
 * at all, the paper's opening passages (title, abstract, introduction) are
 * returned, so a broad question like "what is this paper about?" still
 * gets grounded context.
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
  const queryTokens = tokenize(query);
  const index = new Bm25Index(allChunks.map((c) => tokenize(c.text)));

  const scored: Scored[] = allChunks.map((c, i) => ({
    lexical: index.score(queryTokens, i),
    vector: sameModeVector(c, queryVector, queryMode),
  }));
  const { fused, lexRanks, vecRanks } = fuse(scored, queryMode);

  const eligible = allChunks
    .map((c, i) => ({ c, i }))
    .filter(({ i }) => (lexRanks[i] ?? 0) > 0 || (queryMode === "local-model" && (vecRanks[i] ?? Infinity) <= limit * 2))
    .sort((a, b) => fused[b.i] - fused[a.i])
    .slice(0, limit);

  const results: RetrievedChunk[] = eligible.map(({ c, i }) => ({
    chunkId: c.id,
    text: c.text,
    chunkIndex: c.chunkIndex,
    score: fused[i],
    matchType: (lexRanks[i] ?? Infinity) <= (vecRanks[i] ?? Infinity) ? "lexical" : "vector",
  }));

  // Broad question with no keyword match: ground it in the opening passages.
  if (results.length < Math.min(2, limit)) {
    const have = new Set(results.map((r) => r.chunkId));
    for (const c of allChunks) {
      if (results.length >= Math.min(3, limit)) break;
      if (have.has(c.id)) continue;
      results.push({ chunkId: c.id, text: c.text, chunkIndex: c.chunkIndex, score: 0, matchType: "lexical" });
    }
  }

  return results;
}

export interface CorpusRetrievedChunk extends RetrievedChunk {
  articleId: string;
  articleTitle: string;
  /** True when the question names this chunk's article (by title or
   * author), so the answer should be about that article specifically. */
  focused?: boolean;
}

/** Name tokens for author matching ("Rivera", "Ana Rivera"). */
function authorNameTokens(authorsJson: string): Set<string> {
  const names = new Set<string>();
  try {
    const authors = JSON.parse(authorsJson) as { name?: string }[];
    for (const a of Array.isArray(authors) ? authors : []) {
      for (const t of tokenize(a?.name ?? "")) if (t.length >= 3) names.add(t);
    }
  } catch {
    // Malformed authors JSON: no author matching for this article.
  }
  return names;
}

/** At most this many passages from one article when the question isn't
 * about a specific article, so a broad answer draws on several papers. */
const MAX_PASSAGES_PER_ARTICLE = 3;
/** Score bonus for passages of an article the question names. Larger than
 * any single RRF contribution (at most 1/61), so those passages rank first. */
const FOCUS_BONUS = 0.05;

/**
 * Journal-wide counterpart to retrieveChunks(), backing "Ask the Corpus"
 * (src/app/api/corpus-chat/route.ts). Searches every PUBLISHED article's
 * passages and reports which article each came from, so answers can cite
 * their source.
 *
 * - Hybrid ranking: BM25 keyword relevance over each passage (with its
 *   article's title), fused with same-mode vector similarity.
 * - Article focus: when the question names a paper by its title words or an
 *   author's name, that paper's passages are boosted and its opening
 *   passage (title and abstract) is always included, so the answer is about
 *   the right paper rather than a similar one.
 * - Diversity: otherwise at most three passages per article.
 * - Broad questions ("what topics does this journal cover?") with no
 *   keyword match fall back to the opening passages of the most recently
 *   published articles, never to random passages.
 */
export async function retrieveChunksAcrossCorpus(
  query: string,
  limit = 8
): Promise<CorpusRetrievedChunk[]> {
  const rows = await db.articleChunk.findMany({
    where: { article: { status: "PUBLISHED" } },
    include: { article: { select: { title: true, authors: true, keywords: true, publishedAt: true } } },
    orderBy: [{ articleId: "asc" }, { chunkIndex: "asc" }],
  });
  if (rows.length === 0) return [];
  const { vector, mode } = await generateChunkEmbedding(query);
  return rankCorpusChunks(rows, query, vector, mode, limit);
}

/** A stored passage plus the fields of its article that ranking uses. */
export interface CorpusChunkRow {
  id: string;
  articleId: string;
  chunkIndex: number;
  text: string;
  embedding: string;
  embeddingDims: number;
  embeddingMode: string;
  article: { title: string; authors: string; keywords: string | null; publishedAt: Date | null };
}

/**
 * The ranking behind retrieveChunksAcrossCorpus(), separated from the
 * database and embedding model so it can be tested directly. `rows` must
 * be ordered by article, then chunkIndex.
 */
export function rankCorpusChunks(
  rows: CorpusChunkRow[],
  query: string,
  queryVector: number[],
  queryMode: EmbeddingMode,
  limit = 8
): CorpusRetrievedChunk[] {
  if (rows.length === 0) return [];
  const queryTokens = tokenize(query);
  const querySet = new Set(queryTokens);

  // Which articles does the question name?
  const focus = new Map<string, number>();
  const articleMeta = new Map<string, { title: string; publishedAt: Date | null }>();
  for (const r of rows) {
    if (!articleMeta.has(r.articleId)) {
      articleMeta.set(r.articleId, { title: r.article.title, publishedAt: r.article.publishedAt ?? null });
    }
  }
  const titleDf = titleDocumentFrequency([...articleMeta.values()].map((a) => a.title));
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.articleId)) continue;
    seen.add(r.articleId);
    const m = titleMatch(queryTokens, r.article.title, titleDf);
    const byAuthor = [...authorNameTokens(r.article.authors)].some((t) => querySet.has(t));
    if (isFocusedMatch(m) || byAuthor) focus.set(r.articleId, m.coverage + (byAuthor ? 0.5 : 0));
  }

  const index = new Bm25Index(
    rows.map((r) => tokenize(`${r.article.title} ${r.article.keywords ?? ""} ${r.text}`))
  );
  const scored: Scored[] = rows.map((r, i) => ({
    lexical: index.score(queryTokens, i),
    vector: sameModeVector(r, queryVector, queryMode),
  }));
  const { fused, lexRanks, vecRanks } = fuse(scored, queryMode);
  const total = rows.map((r, i) => fused[i] + (focus.has(r.articleId) ? FOCUS_BONUS * (focus.get(r.articleId) ?? 1) : 0));

  const toResult = (i: number, matchType?: "vector" | "lexical"): CorpusRetrievedChunk => {
    const r = rows[i];
    return {
      chunkId: r.id,
      text: r.text,
      chunkIndex: r.chunkIndex,
      score: total[i],
      matchType: matchType ?? ((lexRanks[i] ?? Infinity) <= (vecRanks[i] ?? Infinity) ? "lexical" : "vector"),
      articleId: r.articleId,
      articleTitle: r.article.title,
      ...(focus.has(r.articleId) ? { focused: true } : {}),
    };
  };

  const results: CorpusRetrievedChunk[] = [];
  const taken = new Set<number>();
  const perArticle = new Map<string, number>();
  const take = (i: number, matchType?: "vector" | "lexical") => {
    if (taken.has(i) || results.length >= limit) return;
    taken.add(i);
    perArticle.set(rows[i].articleId, (perArticle.get(rows[i].articleId) ?? 0) + 1);
    results.push(toResult(i, matchType));
  };

  // 1. The opening passage (title + abstract) of each named article, best match first.
  const focusedIds = [...focus.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, 2);
  for (const id of focusedIds) {
    const opening = rows.findIndex((r) => r.articleId === id);
    if (opening !== -1) take(opening, "lexical");
  }

  // 2. The best-ranked relevant passages.
  const eligible = rows
    .map((_, i) => i)
    .filter(
      (i) =>
        (lexRanks[i] ?? 0) > 0 ||
        focus.has(rows[i].articleId) ||
        (queryMode === "local-model" && (vecRanks[i] ?? Infinity) <= limit * 2)
    )
    .sort((a, b) => total[b] - total[a]);
  for (const i of eligible) {
    if (results.length >= limit) break;
    const id = rows[i].articleId;
    if (!focus.has(id) && (perArticle.get(id) ?? 0) >= MAX_PASSAGES_PER_ARTICLE) continue;
    take(i);
  }

  // 3. Broad questions: opening passages of the most recent articles.
  if (results.length < Math.min(3, limit)) {
    const newestFirst = [...articleMeta.entries()].sort(
      (a, b) => (b[1].publishedAt?.getTime() ?? 0) - (a[1].publishedAt?.getTime() ?? 0)
    );
    for (const [id] of newestFirst) {
      if (results.length >= limit) break;
      if (perArticle.has(id)) continue;
      const opening = rows.findIndex((r) => r.articleId === id);
      if (opening !== -1) take(opening, "lexical");
    }
  }

  return results;
}
