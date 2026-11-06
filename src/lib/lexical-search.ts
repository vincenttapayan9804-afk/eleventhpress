/**
 * Keyword relevance ranking for RAG retrieval (Ask the Corpus, Ask this paper).
 *
 * Pure functions, no I/O. Okapi BM25 is the standard ranking function behind
 * most search engines. It rewards passages that contain the question's rarer,
 * more specific terms (a method name, a place, a variable) far more than
 * passages that only share common words.
 *
 * This matters because the semantic embedding model can't always load on
 * serverless hosts (see chunk-embeddings.ts). When it can't, the hashed
 * n-gram fallback is too crude to find the right passages on its own. BM25
 * on its own is a strong baseline for factual questions over academic text,
 * and retrieval fuses it with whatever vector signal is available.
 */

const STOPWORDS = new Set(
  (
    "a about above after again against all am an and any are aren as at be because been before being below " +
    "between both but by can cannot could did do does doing down during each few for from further had has have " +
    "having he her here hers herself him himself his how i if in into is it its itself just me more most my " +
    "myself no nor not now of off on once only or other ought our ours ourselves out over own same she should so " +
    "some such than that the their theirs them themselves then there these they this those through to too under " +
    "until up very was we were what when where which while who whom why will with would you your yours yourself " +
    "yourselves also may might must shall us via per within without upon among across tell explain describe " +
    "please give show say said says find found paper papers article articles study studies journal research " +
    "author authors"
  ).split(/\s+/)
);

/** Light English stemming: enough to match "models"/"model" and
 * "studies"/"study" without a dependency. Conservative, so distinct
 * technical terms aren't merged. */
function stem(token: string): string {
  if (token.length <= 3 || /\d/.test(token)) return token;
  if (token.endsWith("ies") && token.length > 4) return token.slice(0, -3) + "y";
  if (token.endsWith("sses")) return token.slice(0, -2);
  if (token.endsWith("ss") || token.endsWith("us") || token.endsWith("is")) return token;
  if (token.endsWith("s")) return token.slice(0, -1);
  return token;
}

/** Lowercases, strips accents, splits on non-alphanumerics, drops stopwords
 * and stems. Single digits are dropped; numbers like years are kept. */
export function tokenize(text: string): string[] {
  const normalized = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  const raw = normalized.match(/[a-z0-9]+/g) ?? [];
  const out: string[] = [];
  for (const t of raw) {
    if (t.length < 2 || STOPWORDS.has(t)) continue;
    out.push(stem(t));
  }
  return out;
}

/** Okapi BM25 over a fixed set of pre-tokenized documents. */
export class Bm25Index {
  private readonly termFreqs: Map<string, number>[];
  private readonly docLengths: number[];
  private readonly avgDocLength: number;
  private readonly docFreq = new Map<string, number>();

  constructor(
    docs: string[][],
    private readonly k1 = 1.2,
    private readonly b = 0.75
  ) {
    this.termFreqs = docs.map((tokens) => {
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const t of tf.keys()) this.docFreq.set(t, (this.docFreq.get(t) ?? 0) + 1);
      return tf;
    });
    this.docLengths = docs.map((d) => d.length);
    const total = this.docLengths.reduce((s, n) => s + n, 0);
    this.avgDocLength = docs.length ? total / docs.length || 1 : 1;
  }

  get size(): number {
    return this.termFreqs.length;
  }

  /** Inverse document frequency (BM25+ style, never negative). */
  idf(term: string): number {
    const n = this.termFreqs.length;
    const df = this.docFreq.get(term) ?? 0;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  score(queryTokens: string[], docIndex: number): number {
    const tf = this.termFreqs[docIndex];
    const len = this.docLengths[docIndex];
    let total = 0;
    for (const term of new Set(queryTokens)) {
      const f = tf.get(term);
      if (!f) continue;
      const norm = f + this.k1 * (1 - this.b + (this.b * len) / this.avgDocLength);
      total += this.idf(term) * ((f * (this.k1 + 1)) / norm);
    }
    return total;
  }
}

/**
 * How clearly a question names one specific article. "What did the paper
 * on mangrove restoration in coastal Bangladesh find?" matches that
 * article's title even though it doesn't quote it exactly.
 *
 * - coverage: share of the title's terms that appear in the question (0 to 1)
 * - matched: how many title terms appear in the question
 * - distinctive: how many of those appear in no other article's title
 *   (needs `titleDocFreq`, the number of titles each term appears in)
 */
export function titleMatch(
  questionTokens: string[],
  title: string,
  titleDocFreq?: Map<string, number>
): { coverage: number; matched: number; distinctive: number } {
  const titleTerms = new Set(tokenize(title));
  if (titleTerms.size === 0) return { coverage: 0, matched: 0, distinctive: 0 };
  const q = new Set(questionTokens);
  let matched = 0;
  let distinctive = 0;
  for (const t of titleTerms) {
    if (!q.has(t)) continue;
    matched++;
    if (titleDocFreq && (titleDocFreq.get(t) ?? 0) <= 1) distinctive++;
  }
  return { coverage: matched / titleTerms.size, matched, distinctive };
}

/** Number of titles each term appears in, for titleMatch(). */
export function titleDocumentFrequency(titles: string[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const title of titles) for (const t of new Set(tokenize(title))) df.set(t, (df.get(t) ?? 0) + 1);
  return df;
}

/** True when the title match is strong enough to treat the question as
 * being about that article: most of its title, or two terms that only
 * this article's title uses. */
export function isFocusedMatch(m: { coverage: number; matched: number; distinctive?: number }): boolean {
  return (
    (m.matched >= 2 && m.coverage >= 0.5) ||
    (m.matched >= 3 && m.coverage >= 0.34) ||
    (m.distinctive ?? 0) >= 2
  );
}
