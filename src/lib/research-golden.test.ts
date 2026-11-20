import { describe, expect, test } from "bun:test";
import { hashEmbedding } from "./embeddings";
import { galleyToPassages, sectionsForQuestion } from "./section-chunker";
import { GOLDEN_ARTICLES, GOLDEN_QUESTIONS, type GoldenQuestion } from "./__fixtures__/research-golden";

/**
 * Golden-set retrieval eval for the Research Assistant: the fixture journal
 * goes through the real section chunker and the real ranking, with the
 * hashed embeddings production falls back to, and every question must
 * bring back the right article(s), and for section questions the right
 * part of the paper. Deterministic, no model calls, so it runs in CI.
 *
 * The thresholds at the end hold the line on retrieval quality: a change
 * that lowers recall or MRR fails here. Full answers (citations, timing)
 * are evaluated against a deployment with scripts/eval-research-assistant.ts.
 *
 * Other test files mock "@/lib/chunk-embeddings", so the real module is
 * imported through a query-string specifier that bypasses those mocks.
 */
type ChunkModule = typeof import("./chunk-embeddings");
const REAL_CHUNKS = "./chunk-embeddings.ts?real=research-golden-test";
const { rankCorpusChunks } = (await import(REAL_CHUNKS)) as ChunkModule;
type Row = Parameters<ChunkModule["rankCorpusChunks"]>[0][number];

const DIMS = 384;
const SEPARATOR = " › ";

const ROWS: Row[] = GOLDEN_ARTICLES.flatMap((a) => {
  const meta = { title: a.title, authors: JSON.stringify(a.authors.map((name) => ({ name }))), keywords: a.keywords, publishedAt: new Date(a.publishedAt) };
  return galleyToPassages(a.html).map((p, i) => {
    const headingPath = p.headingPath.length ? p.headingPath.join(SEPARATOR) : null;
    // As indexArticleChunks embeds them: the heading path, then the text.
    const embedded = headingPath ? `${headingPath}\n${p.text}` : p.text;
    return {
      id: `${a.id}-c${i}`,
      articleId: a.id,
      chunkIndex: i,
      text: p.text,
      embedding: JSON.stringify(hashEmbedding(embedded, DIMS)),
      embeddingDims: DIMS,
      embeddingMode: "hash-fallback",
      section: p.section,
      headingPath,
      kind: p.kind,
      article: meta,
    };
  });
});

const LIMIT = 8;

function retrieve(q: GoldenQuestion) {
  return rankCorpusChunks(ROWS, q.question, hashEmbedding(q.question, DIMS), "hash-fallback", LIMIT, {
    sections: sectionsForQuestion(q.question),
    ...(q.kind === "comparison" ? { maxFocused: 3 } : {}),
  });
}

interface Outcome {
  q: GoldenQuestion;
  articles: string[];
  /** Every expected article within the top `k` articles (k = 1 per expected article, +1 slack). */
  hit: boolean;
  /** 1 / rank of the best-placed expected article among articles. */
  rr: number;
  sectionOk: boolean | null;
}

function evaluate(q: GoldenQuestion): Outcome {
  const results = retrieve(q);
  const articles = [...new Set(results.map((r) => r.articleId))];
  const k = q.expect.length + 1;
  const hit = q.expect.every((id) => articles.slice(0, k).includes(id));
  const ranks = q.expect.map((id) => articles.indexOf(id)).filter((r) => r !== -1);
  const rank = ranks.length ? Math.min(...ranks) : -1;
  const rr = rank === -1 ? 0 : 1 / (rank + 1);
  let sectionOk: boolean | null = null;
  if (q.section) {
    // The model sees every retrieved passage, so the right section must be among them
    // (a named paper's opening passage deliberately comes first).
    sectionOk = results.some((r) => r.articleId === q.expect[0] && ROWS.find((x) => x.articleId === r.articleId && x.chunkIndex === r.chunkIndex)?.section === q.section);
  }
  return { q, articles, hit, rr, sectionOk };
}

const OUTCOMES = GOLDEN_QUESTIONS.map(evaluate);

describe("Research Assistant golden set", () => {
  test("the fixture journal is chunked into sections, tables and equations", () => {
    expect(ROWS.some((r) => r.kind === "table" && r.articleId === "tle")).toBe(true);
    expect(ROWS.some((r) => r.articleId === "mathanxiety" && r.text.includes("$$\\hat{y} = \\beta_0"))).toBe(true);
    expect(ROWS.some((r) => r.articleId === "sepsis" && r.text.includes("$$\\mathrm{AUROC}"))).toBe(true);
    expect(new Set(ROWS.map((r) => r.section)).has("limitations")).toBe(true);
  });

  for (const o of OUTCOMES) {
    test(`[${o.q.kind}] ${o.q.question}`, () => {
      // Reported, not asserted one by one: the aggregate thresholds below decide.
      if (!o.hit || o.sectionOk === false || o.rr < 1) {
        console.info(`  miss: expected ${o.q.expect.join(" + ")}${o.q.section ? ` (${o.q.section})` : ""}, got ${o.articles.slice(0, 4).join(", ")}`);
      }
      expect(o.articles.length).toBeGreaterThan(0);
    });
  }

  test("aggregate recall, MRR and section accuracy hold their baseline", () => {
    const recall = OUTCOMES.filter((o) => o.hit).length / OUTCOMES.length;
    const mrr = OUTCOMES.reduce((s, o) => s + o.rr, 0) / OUTCOMES.length;
    const withSection = OUTCOMES.filter((o) => o.sectionOk !== null);
    const sectionAcc = withSection.filter((o) => o.sectionOk).length / withSection.length;
    const comparisons = OUTCOMES.filter((o) => o.q.kind === "comparison");
    console.info(
      `  golden set: ${OUTCOMES.length} questions · recall ${(recall * 100).toFixed(0)}% · MRR ${mrr.toFixed(3)} · section ${(sectionAcc * 100).toFixed(0)}% (${withSection.length}) · comparisons ${comparisons.filter((o) => o.hit).length}/${comparisons.length}`
    );
    expect(recall).toBeGreaterThanOrEqual(RECALL_MIN);
    expect(mrr).toBeGreaterThanOrEqual(MRR_MIN);
    expect(sectionAcc).toBeGreaterThanOrEqual(SECTION_MIN);
  });
});

// Baseline at writing: recall 100%, MRR 0.946, section 100% (28 questions).
const RECALL_MIN = 0.96;
const MRR_MIN = 0.91;
const SECTION_MIN = 0.88;
