import { describe, test, expect } from "bun:test";
import { tokenize, Bm25Index, titleMatch, isFocusedMatch, titleDocumentFrequency } from "./lexical-search";
import { hashEmbedding } from "./embeddings";

/**
 * Retrieval quality for "Ask the Corpus": given a small journal, the right
 * passages from the right paper must come back first. These run against
 * the pure ranking function, with the same hashed fallback embeddings
 * production currently uses (the sentence model can't load on Vercel).
 *
 * Other test files mock "@/lib/chunk-embeddings", so the real module is
 * imported through a query-string specifier that bypasses those mocks.
 */
type ChunkModule = typeof import("./chunk-embeddings");
const REAL_CHUNKS = "./chunk-embeddings.ts?real=corpus-retrieval-test";
const { rankCorpusChunks } = (await import(REAL_CHUNKS)) as ChunkModule;
type Row = Parameters<ChunkModule["rankCorpusChunks"]>[0][number];

const DIMS = 384;

function article(
  id: string,
  title: string,
  authors: string[],
  keywords: string,
  publishedAt: string,
  passages: string[]
): Row[] {
  const meta = {
    title,
    authors: JSON.stringify(authors.map((name) => ({ name }))),
    keywords,
    publishedAt: new Date(publishedAt),
  };
  return passages.map((text, i) => ({
    id: `${id}-c${i}`,
    articleId: id,
    chunkIndex: i,
    text,
    embedding: JSON.stringify(hashEmbedding(text, DIMS)),
    embeddingDims: DIMS,
    embeddingMode: "hash-fallback",
    article: meta,
  }));
}

const MANGROVE = article(
  "mangrove",
  "Mangrove Restoration and Storm-Surge Protection in Coastal Bangladesh",
  ["Ana Rivera", "Rahim Uddin"],
  "mangroves, coastal resilience, storm surge, Bangladesh",
  "2026-03-10",
  [
    "Mangrove Restoration and Storm-Surge Protection in Coastal Bangladesh. Abstract: We assess whether restored mangrove belts reduce storm-surge damage to coastal villages.",
    "Methods: we sampled 42 villages across Khulna and Satkhira districts, comparing restored and unrestored shorelines over three cyclone seasons.",
    "Results: villages behind restored mangrove belts recorded 31.4% less storm-surge damage to housing than matched controls.",
    "Limitations: damage assessments relied on household self-reports, and restoration age varied between sites.",
  ]
);

const SEPSIS = article(
  "sepsis",
  "Machine Learning for Early Sepsis Detection in Intensive Care Units",
  ["Kenji Tanaka"],
  "sepsis, machine learning, ICU, early warning",
  "2026-06-02",
  [
    "Machine Learning for Early Sepsis Detection in Intensive Care Units. Abstract: We develop a gradient-boosted model that flags sepsis risk from routine vital signs.",
    "Data: 18,204 ICU admissions from a single tertiary hospital between 2019 and 2023.",
    "Results: the model achieved an AUROC of 0.87 and detected sepsis a median of 5.2 hours before clinical diagnosis.",
    "Limitations: single-centre data and retrospective design limit generalisability.",
  ]
);

const TEACHERS = article(
  "teachers",
  "Teacher Workload and Burnout in Rural Philippine Schools",
  ["Maria Santos"],
  "teacher burnout, workload, rural education, Philippines",
  "2026-09-15",
  [
    "Teacher Workload and Burnout in Rural Philippine Schools. Abstract: This study examines how administrative workload relates to burnout among rural public-school teachers.",
    "Methods: a survey of 512 teachers in Samar and Leyte using the Maslach Burnout Inventory.",
    "Results: teachers reporting more than 10 hours of weekly paperwork had markedly higher emotional exhaustion scores.",
    "Recommendations: reduce non-teaching administrative tasks and hire administrative support staff.",
  ]
);

const CORPUS = [...MANGROVE, ...SEPSIS, ...TEACHERS];

function rank(question: string, limit = 8) {
  return rankCorpusChunks(CORPUS, question, hashEmbedding(question, DIMS), "hash-fallback", limit);
}

describe("lexical-search", () => {
  test("tokenize drops stopwords and question filler, and stems plurals", () => {
    expect(tokenize("What did the authors find about the mangroves in this paper?")).toEqual(["mangrove"]);
    expect(tokenize("Studies of 512 teachers")).toEqual(["512", "teacher"]);
  });

  test("BM25 ranks the passage with the rarer, more specific term first", () => {
    const docs = [
      "climate climate climate adaptation",
      "mangrove restoration reduces damage",
      "climate policy overview",
    ].map(tokenize);
    const idx = new Bm25Index(docs);
    const q = tokenize("mangrove climate");
    expect(idx.score(q, 1)).toBeGreaterThan(idx.score(q, 0));
    expect(idx.score(q, 1)).toBeGreaterThan(idx.score(q, 2));
  });

  test("title matching recognises a paraphrased reference to a paper", () => {
    const df = titleDocumentFrequency([MANGROVE, SEPSIS, TEACHERS].map((a) => a[0].article.title));
    const q = tokenize("what did the sepsis detection paper report?");
    expect(isFocusedMatch(titleMatch(q, SEPSIS[0].article.title, df))).toBe(true);
    expect(isFocusedMatch(titleMatch(q, TEACHERS[0].article.title, df))).toBe(false);
    // One shared word isn't enough to assume the reader means a paper.
    expect(isFocusedMatch(titleMatch(tokenize("coastal schools"), MANGROVE[0].article.title, df))).toBe(false);
  });
});

describe("Ask the Corpus retrieval", () => {
  test("a question naming a paper returns that paper's opening passage first and its result passage", () => {
    const results = rank("What were the results of the early sepsis detection study?");
    expect(results[0].articleId).toBe("sepsis");
    expect(results[0].chunkIndex).toBe(0);
    expect(results[0].focused).toBe(true);
    const sepsisChunks = results.filter((r) => r.articleId === "sepsis").map((r) => r.chunkIndex);
    expect(sepsisChunks).toContain(2);
    // Every passage of the named paper ranks ahead of other papers' passages.
    const firstOther = results.findIndex((r) => r.articleId !== "sepsis");
    expect(firstOther === -1 || firstOther >= sepsisChunks.length).toBe(true);
  });

  test("a question naming an author focuses on that author's paper", () => {
    const results = rank("What did Tanaka find?");
    expect(results[0].articleId).toBe("sepsis");
    expect(results[0].focused).toBe(true);
  });

  test("a specific factual question surfaces the passage containing the fact", () => {
    const results = rank("How many teachers were surveyed and which instrument was used?");
    expect(results[0].articleId).toBe("teachers");
    expect(results.slice(0, 2).some((r) => r.articleId === "teachers" && r.chunkIndex === 1)).toBe(true);
  });

  test("a numeric detail is found by keyword even when phrased differently", () => {
    const results = rank("How much less storm surge damage did restored mangroves see?");
    expect(results[0].articleId).toBe("mangrove");
    expect(results.slice(0, 3).some((r) => r.articleId === "mangrove" && r.chunkIndex === 2)).toBe(true);
  });

  test("hashed vectors alone never pull in passages with no keyword overlap", () => {
    const results = rank("limitations of the sepsis model");
    for (const r of results) {
      const relevant = r.articleId === "sepsis" || /limitation/i.test(r.text);
      expect(relevant).toBe(true);
    }
  });

  test("an unfocused question takes at most three passages from any one article", () => {
    const results = rank("results methods limitations abstract");
    const counts = new Map<string, number>();
    for (const r of results) counts.set(r.articleId, (counts.get(r.articleId) ?? 0) + 1);
    for (const n of counts.values()) expect(n).toBeLessThanOrEqual(3);
    expect(counts.size).toBe(3);
  });

  test("a broad question with no keyword match falls back to the newest articles' opening passages", () => {
    const results = rank("Give me an overview of what is being published");
    expect(results.length).toBe(3);
    expect(results.map((r) => r.articleId)).toEqual(["teachers", "sepsis", "mangrove"]);
    expect(results.every((r) => r.chunkIndex === 0)).toBe(true);
  });

  test("respects the passage limit", () => {
    expect(rank("results", 2)).toHaveLength(2);
  });
});
