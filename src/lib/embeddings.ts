/**
 * Semantic search service — generates vector embeddings for articles and
 * performs cosine-similarity search.
 *
 * The Anthropic API has no embeddings endpoint (Claude is a generation
 * model, not an embedding model), so this uses a deterministic hashed
 * n-gram embedding rather than a hosted provider — see hashEmbedding()
 * below. It captures lexical overlap (shared vocabulary clusters
 * together) but not real semantic similarity. Swap in a dedicated
 * embeddings provider (e.g. Voyage AI, Anthropic's recommended partner)
 * behind this same generateEmbedding() signature if true semantic search
 * is needed later — every caller already goes through this one function.
 */
import { db } from "@/lib/db";
import crypto from "crypto";

const EMBEDDING_DIMS = 256;

/**
 * Generate an embedding vector for an article's title + abstract + keywords.
 * Returns a float array of EMBEDDING_DIMS dimensions.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  return hashEmbedding(text, EMBEDDING_DIMS);
}

/**
 * Deterministic embedding: hashes overlapping n-grams of the text and uses
 * each hash to seed a dimension. Articles with similar vocabulary will
 * have vectors that cluster together.
 */
function hashEmbedding(text: string, dims: number): number[] {
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

function padOrTruncate(vec: number[], dims: number): number[] {
  if (vec.length === dims) return vec;
  if (vec.length > dims) return vec.slice(0, dims);
  return [...vec, ...new Array(dims - vec.length).fill(0)];
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
  const embedding = await generateEmbedding(text);
  const textHash = crypto.createHash("sha256").update(text).digest("hex");

  await db.articleEmbedding.upsert({
    where: { articleId },
    create: {
      articleId,
      embedding: JSON.stringify(embedding),
      textHash,
      dimensions: EMBEDDING_DIMS,
    },
    update: {
      embedding: JSON.stringify(embedding),
      textHash,
      dimensions: EMBEDDING_DIMS,
      updatedAt: new Date(),
    },
  });
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

  // Fetch all embeddings (in production this would be a vector DB query)
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

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
