/**
 * Optional cross-encoder re-ranking for the Research Assistant's passages.
 *
 * When RERANK_URL points at a self-hosted re-ranker that speaks the
 * text-embeddings-inference API (POST {url}/rerank with {query, texts},
 * answering [{index, score}]) — for example TEI serving an open BGE
 * re-ranker — the best retrieved passages are re-ordered by how well each
 * one answers the question, which is sharper than keyword and embedding
 * similarity alone. Without it, or when it is slow or down, nothing
 * changes: rerank() returns null and the existing order stands.
 */
import { envValue } from "@/lib/llm";

const DEFAULT_TIMEOUT_MS = 3000;
/** Characters of each passage sent; cross-encoders read ~512 tokens at most. */
const MAX_TEXT_CHARS = 1500;

export function rerankConfigured(): boolean {
  return !!envValue("RERANK_URL");
}

/**
 * Relevance scores for `texts` against `query` (same order as `texts`), or
 * null when no re-ranker is configured or it failed.
 */
export async function rerank(query: string, texts: string[], signal?: AbortSignal): Promise<number[] | null> {
  const base = envValue("RERANK_URL");
  if (!base || texts.length === 0) return null;
  const timeoutMs = Number(envValue("RERANK_TIMEOUT_MS")) || DEFAULT_TIMEOUT_MS;
  const key = envValue("RERANK_API_KEY");
  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/rerank`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({ query: query.slice(0, 1000), texts: texts.map((t) => t.slice(0, MAX_TEXT_CHARS)), truncate: true }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as unknown;
    const items = Array.isArray(data) ? data : (data as { results?: unknown })?.results;
    if (!Array.isArray(items)) throw new Error("unexpected response");
    const scores: number[] = texts.map(() => Number.NEGATIVE_INFINITY);
    let seen = 0;
    for (const it of items as { index?: unknown; score?: unknown; relevance_score?: unknown }[]) {
      const i = Number(it?.index);
      const s = Number(it?.score ?? it?.relevance_score);
      if (Number.isInteger(i) && i >= 0 && i < texts.length && Number.isFinite(s)) {
        scores[i] = s;
        seen++;
      }
    }
    if (seen === 0) throw new Error("no scores");
    return scores;
  } catch (e) {
    console.warn("[reranker] skipped:", e instanceof Error ? e.message : e);
    return null;
  }
}
