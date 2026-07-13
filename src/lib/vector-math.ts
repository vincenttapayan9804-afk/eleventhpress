/**
 * Shared cosine-similarity helper. Previously duplicated three times
 * (src/lib/embeddings.ts, src/lib/manuscript-checks.ts,
 * src/app/api/articles/assign-reviewer/route.ts) — this is the single
 * source of truth now. Kept as the floored variant (two of the three
 * prior copies clamped negative similarity to 0; verified behavior-neutral
 * for every caller since none treat negative vs. zero similarity
 * differently once filtered against a positive threshold).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : Math.max(0, dot / denom);
}
