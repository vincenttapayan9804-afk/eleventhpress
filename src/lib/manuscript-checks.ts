/**
 * Manuscript quality checks — similarity, statistical sanity, and
 * AI-assisted lay summary / keyword suggestion.
 *
 * Similarity is a real check (cosine similarity over this platform's own
 * corpus via src/lib/embeddings.ts) — it isn't a Crossref Similarity Check /
 * iThenticate replacement (those require a paid subscription and check
 * against a far larger index), but it genuinely detects duplicate or
 * self-plagiarized submissions against everything already in this journal.
 * See docs/standards.md.
 *
 * Statistical sanity and lay-summary/keywords go through the real
 * Anthropic API (src/lib/llm.ts) when configured, falling back to a
 * deterministic heuristic otherwise — same "real LLM, honest fallback"
 * pattern as src/lib/triage.ts.
 */
import { db } from "@/lib/db";
import { chatJSON, anyLLMAvailable } from "@/lib/llm";
import { generateEmbedding } from "@/lib/embeddings";
import { cosineSimilarity } from "@/lib/vector-math";
import { ensurePgvector, vectorLiteral } from "@/lib/pgvector";

// ---------------------------------------------------------------------------
// Similarity check
// ---------------------------------------------------------------------------

export interface SimilarityMatch {
  articleId: string;
  title: string;
  score: number; // 0-100
}

export interface SimilarityResult {
  score: number; // 0-100, the top match's score (or 0 if no corpus to compare against)
  matches: SimilarityMatch[]; // top 3 matches above the noise floor
}

/**
 * Compares `text` (usually title + abstract) against every other indexed
 * article's embedding and returns the closest matches. Pass the new
 * article's own id (once it exists) as `excludeArticleId` to skip
 * comparing it against itself.
 */
export async function checkSimilarity(
  text: string,
  excludeArticleId?: string
): Promise<SimilarityResult> {
  const queryEmbedding = await generateEmbedding(text);

  if (await ensurePgvector()) {
    try {
      const literal = vectorLiteral(queryEmbedding);
      const rows = excludeArticleId
        ? await db.$queryRaw<{ articleId: string; title: string; score: number }[]>`
            SELECT ve.article_id AS "articleId", a.title,
                   1 - (ve.embedding <=> ${literal}::vector) AS score
            FROM vec.article_embedding_v384 ve
            JOIN public."Article" a ON a.id = ve.article_id
            WHERE ve.article_id != ${excludeArticleId}
            ORDER BY ve.embedding <=> ${literal}::vector ASC
            LIMIT 3
          `
        : await db.$queryRaw<{ articleId: string; title: string; score: number }[]>`
            SELECT ve.article_id AS "articleId", a.title,
                   1 - (ve.embedding <=> ${literal}::vector) AS score
            FROM vec.article_embedding_v384 ve
            JOIN public."Article" a ON a.id = ve.article_id
            ORDER BY ve.embedding <=> ${literal}::vector ASC
            LIMIT 3
          `;
      const scored = rows
        .map((r) => ({ articleId: r.articleId, title: r.title, score: Math.round(Math.max(0, r.score) * 100) }))
        .filter((m) => m.score > 0);
      return { score: scored[0]?.score ?? 0, matches: scored };
    } catch (e) {
      console.error("[manuscript-checks] pgvector checkSimilarity failed, falling back to in-memory scan:", e);
    }
  }

  // Fallback: unbounded in-memory scan, unchanged from before pgvector.
  const allEmbeddings = await db.articleEmbedding.findMany({
    where: excludeArticleId ? { articleId: { not: excludeArticleId } } : undefined,
    include: { article: { select: { id: true, title: true } } },
  });

  const scored = allEmbeddings
    .map((e) => {
      const vec = JSON.parse(e.embedding) as number[];
      const sim = cosineSimilarity(queryEmbedding, vec);
      return { articleId: e.articleId, title: e.article.title, score: Math.round(sim * 100) };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    score: scored[0]?.score ?? 0,
    matches: scored,
  };
}

export interface SimilarArticle {
  articleId: string;
  score: number;
}

/**
 * Reader-facing counterpart to checkSimilarity() — finds PUBLISHED
 * articles most similar to an already-published one, using that article's
 * own precomputed ArticleEmbedding (written at submit/publish time by
 * src/lib/embeddings.ts's indexArticle()) rather than re-embedding text.
 * Backs the article page's "Continue reading" recommendations
 * (previously a same-discipline lookup, not a similarity ranking) — see
 * src/app/api/articles/[id]/similar/route.ts. Returns an empty array
 * (never a fabricated ranking) if the article has no embedding yet.
 */
export async function getSimilarArticles(articleId: string, limit = 3): Promise<SimilarArticle[]> {
  const own = await db.articleEmbedding.findUnique({ where: { articleId } });
  if (!own) return [];
  const queryEmbedding = JSON.parse(own.embedding) as number[];

  if (await ensurePgvector()) {
    try {
      const literal = vectorLiteral(queryEmbedding);
      const rows = await db.$queryRaw<{ articleId: string; score: number }[]>`
        SELECT ve.article_id AS "articleId", 1 - (ve.embedding <=> ${literal}::vector) AS score
        FROM vec.article_embedding_v384 ve
        JOIN public."Article" a ON a.id = ve.article_id
        WHERE ve.article_id != ${articleId} AND a.status = 'PUBLISHED'
        ORDER BY ve.embedding <=> ${literal}::vector ASC
        LIMIT ${limit}
      `;
      return rows.map((r) => ({ articleId: r.articleId, score: Math.round(Math.max(0, r.score) * 100) }));
    } catch (e) {
      console.error("[manuscript-checks] pgvector getSimilarArticles failed, falling back to in-memory scan:", e);
    }
  }

  const allEmbeddings = await db.articleEmbedding.findMany({
    where: { articleId: { not: articleId }, article: { status: "PUBLISHED" } },
  });
  return allEmbeddings
    .map((e) => ({
      articleId: e.articleId,
      score: Math.round(cosineSimilarity(queryEmbedding, JSON.parse(e.embedding) as number[]) * 100),
    }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Statistical sanity check
// ---------------------------------------------------------------------------

export interface StatisticalFlag {
  flag: string;
  severity: "info" | "warning" | "concern";
  explanation: string;
}

export interface StatisticalCheckResult {
  flags: StatisticalFlag[];
  mode: "llm" | "heuristic";
  model: string;
}

const STATS_SYSTEM_PROMPT = `You are a statistical methodology reviewer for an academic journal. Read the manuscript abstract (and any provided methods excerpt) and flag common statistical and methodological red flags — do not flag anything not actually present.

Look specifically for: p-hacking language ("marginally significant", multiple comparisons without correction), causal claims from what reads as a correlational/observational design, overclaiming from a small or unspecified sample size, missing effect sizes or confidence intervals alongside p-values, and unsupported generalization beyond the studied population.

Respond with a single JSON object (no markdown, no preamble):
{
  "flags": [
    {"flag": "<short label>", "severity": "info|warning|concern", "explanation": "<one sentence, quote or reference the specific text that triggered this>"}
  ]
}

If nothing notable is present, return {"flags": []}. Do not invent issues to fill the list.`;

export async function checkStatisticalSanity(article: {
  title: string;
  abstract: string;
}): Promise<StatisticalCheckResult> {
  if (anyLLMAvailable()) {
    try {
      const { data, model } = await chatJSON<{ flags: StatisticalFlag[] }>(
        STATS_SYSTEM_PROMPT,
        `Title: ${article.title}\n\nAbstract:\n${article.abstract}`,
        { maxTokens: 1500 }
      );
      return { flags: data.flags ?? [], mode: "llm", model };
    } catch (e) {
      console.error("[manuscript-checks] statistical LLM call failed, falling back:", e);
    }
  }
  return { flags: heuristicStatisticalFlags(article.abstract), mode: "heuristic", model: "heuristic-fallback" };
}

const RED_FLAG_PATTERNS: { pattern: RegExp; flag: string; severity: StatisticalFlag["severity"]; explanation: string }[] = [
  {
    pattern: /marginally significant|approach(ed|ing) significance|trend(ed)? toward significance/i,
    flag: "Marginal-significance language",
    severity: "warning",
    explanation: "Abstract uses \"marginally significant\" or similar language, often associated with p-hacking around the 0.05 threshold.",
  },
  {
    pattern: /\bcauses?\b|\bcaused\b|\bleads? to\b/i,
    flag: "Causal language",
    severity: "info",
    explanation: "Abstract uses causal language (\"causes\"/\"leads to\") — verify the study design supports causal inference rather than correlation.",
  },
  {
    pattern: /\bn\s*=\s*([1-9]|1[0-9])\b/i,
    flag: "Small sample size",
    severity: "warning",
    explanation: "Abstract reports a sample size under 20, which may limit statistical power for the claims made.",
  },
  {
    pattern: /significant(ly)?/i,
    flag: "Significance claimed without effect size",
    severity: "info",
    explanation: "Abstract claims statistical significance; confirm the full manuscript reports effect sizes and confidence intervals alongside p-values.",
  },
];

function heuristicStatisticalFlags(abstract: string): StatisticalFlag[] {
  const flags: StatisticalFlag[] = [];
  for (const { pattern, flag, severity, explanation } of RED_FLAG_PATTERNS) {
    if (pattern.test(abstract)) {
      flags.push({ flag, severity, explanation });
    }
  }
  return flags;
}

// ---------------------------------------------------------------------------
// House-style consistency check
// ---------------------------------------------------------------------------

export interface StyleFlag {
  flag: string;
  severity: "info" | "warning" | "concern";
  explanation: string;
}

export interface StyleCheckResult {
  flags: StyleFlag[];
  mode: "llm" | "heuristic";
  model: string;
}

const STYLE_SYSTEM_PROMPT = `You are a copyeditor checking an academic manuscript's title and abstract for house-style consistency issues — not grammar or content, only internal inconsistency.

Look specifically for: the same term spelled two different ways in the same text (e.g. "e-mail" and "email", "randomised" and "randomized" mixed together), inconsistent capitalization of a repeated key term or proper noun, inconsistent number formatting (spelled-out vs numeral for the same kind of quantity), and inconsistent hyphenation of the same compound term. Only flag something that actually appears inconsistently within the given text — never flag a single, consistently-used style choice as wrong.

Respond with a single JSON object (no markdown, no preamble):
{
  "flags": [
    {"flag": "<short label>", "severity": "info|warning|concern", "explanation": "<one sentence, quote the two conflicting forms found>"}
  ]
}

If nothing notable is present, return {"flags": []}. Do not invent issues to fill the list.`;

export async function checkHouseStyle(article: {
  title: string;
  abstract: string;
}): Promise<StyleCheckResult> {
  if (anyLLMAvailable()) {
    try {
      const { data, model } = await chatJSON<{ flags: StyleFlag[] }>(
        STYLE_SYSTEM_PROMPT,
        `Title: ${article.title}\n\nAbstract:\n${article.abstract}`,
        { maxTokens: 1000, priority: "cost-first" }
      );
      return { flags: data.flags ?? [], mode: "llm", model };
    } catch (e) {
      console.error("[manuscript-checks] house-style LLM call failed, falling back:", e);
    }
  }
  return { flags: heuristicStyleFlags(article.title, article.abstract), mode: "heuristic", model: "heuristic-fallback" };
}

/** Deterministic fallback: flags a same-root spelling variant appearing in
 * both its British and American forms within the combined title+abstract —
 * a much narrower check than the LLM prompt above, but honestly labeled
 * heuristic rather than a fabricated style review. */
function heuristicStyleFlags(title: string, abstract: string): StyleFlag[] {
  const text = `${title} ${abstract}`;
  const flags: StyleFlag[] = [];
  const hasBritish = /\borganise|\brandomised|\bcolour/i.test(text);
  const hasAmerican = /\borganize|\brandomized|\bcolor\b/i.test(text);
  if (hasBritish && hasAmerican) {
    flags.push({
      flag: "Mixed British/American spelling",
      severity: "info",
      explanation: "The text appears to mix British and American spelling variants — consider standardizing on one.",
    });
  }
  if (/\be-mail/i.test(text) && /\bemail\b/i.test(text)) {
    flags.push({
      flag: "Inconsistent hyphenation",
      severity: "info",
      explanation: "Both \"e-mail\" and \"email\" appear — consider standardizing on one form.",
    });
  }
  return flags;
}

// ---------------------------------------------------------------------------
// AI lay summary + keyword suggestion
// ---------------------------------------------------------------------------

export interface AiAssistResult {
  laySummary: string;
  suggestedKeywords: string[];
  mode: "llm" | "heuristic";
  model: string;
}

const AI_ASSIST_SYSTEM_PROMPT = `You write plain-language summaries of academic abstracts for a general audience (the kind a journalist or policy reader would understand), and suggest search-relevant keywords.

Respond with a single JSON object (no markdown, no preamble):
{
  "laySummary": "<2-3 sentences, no jargon, explaining what was studied and why it matters, written for a non-specialist>",
  "suggestedKeywords": ["<keyword or short phrase>", ...]
}

Suggest 5-8 keywords: a mix of the paper's specific technical terms and broader topical terms a reader might search for.`;

export async function suggestKeywordsAndSummary(article: {
  title: string;
  abstract: string;
  keywords: string;
}): Promise<AiAssistResult> {
  if (anyLLMAvailable()) {
    try {
      const { data, model } = await chatJSON<{ laySummary: string; suggestedKeywords: string[] }>(
        AI_ASSIST_SYSTEM_PROMPT,
        `Title: ${article.title}\n\nAbstract:\n${article.abstract}\n\nExisting keywords: ${article.keywords || "(none)"}`,
        { maxTokens: 1000, priority: "cost-first" }
      );
      return {
        laySummary: data.laySummary ?? "",
        suggestedKeywords: data.suggestedKeywords ?? [],
        mode: "llm",
        model,
      };
    } catch (e) {
      console.error("[manuscript-checks] AI-assist LLM call failed, falling back:", e);
    }
  }
  return heuristicAiAssist(article);
}

// ---------------------------------------------------------------------------
// AI-assisted abstract translation — feeds the site's existing 5-locale
// i18n (src/messages/*.json), editor/author-triggered per locale.
// ---------------------------------------------------------------------------

export const TRANSLATABLE_LOCALES = ["es", "fr", "fil", "zh-Hans"] as const;
export type TranslatableLocale = (typeof TRANSLATABLE_LOCALES)[number];

const LOCALE_NAMES: Record<TranslatableLocale, string> = {
  es: "Spanish",
  fr: "French",
  fil: "Filipino (Tagalog-based)",
  "zh-Hans": "Simplified Chinese",
};

export interface TranslateAbstractResult {
  translatedAbstract: string;
  mode: "llm" | "heuristic";
  model: string;
}

const TRANSLATE_SYSTEM_PROMPT = (targetLanguage: string) => `You are a scholarly translator. Translate the given academic abstract into ${targetLanguage}, preserving its academic register and technical terminology precisely — do not simplify, summarize, or add commentary. Respond with a single JSON object (no markdown, no preamble): {"translatedAbstract": "<the translation>"}`;

/**
 * Translates an article's abstract into one target locale via the real
 * Anthropic API. There is no offline machine-translation fallback in this
 * stack (unlike the heuristic fallbacks elsewhere in this file, which can
 * approximate a summary or flag patterns without an LLM) — a translation
 * heuristic would just be wrong, not merely lower-quality — so on failure
 * this returns the original English text unchanged, tagged
 * mode: "heuristic", and callers MUST treat that as "translation
 * unavailable," never present it as if it were real translated text.
 */
export async function translateAbstract(
  article: { title: string; abstract: string },
  targetLocale: TranslatableLocale
): Promise<TranslateAbstractResult> {
  if (anyLLMAvailable()) {
    try {
      const { data, model } = await chatJSON<{ translatedAbstract: string }>(
        TRANSLATE_SYSTEM_PROMPT(LOCALE_NAMES[targetLocale]),
        `Title: ${article.title}\n\nAbstract:\n${article.abstract}`,
        { maxTokens: 1500, priority: "cost-first" }
      );
      if (data.translatedAbstract?.trim()) {
        return { translatedAbstract: data.translatedAbstract.trim(), mode: "llm", model };
      }
    } catch (e) {
      console.error("[manuscript-checks] translation LLM call failed, falling back:", e);
    }
  }
  return { translatedAbstract: article.abstract, mode: "heuristic", model: "heuristic-fallback" };
}

/** Deterministic fallback: first two sentences as a "summary", most-frequent
 * non-trivial words from the abstract as keyword suggestions. Not a real
 * summarization or NLP keyword-extraction — just keeps the feature
 * functional (and honestly labeled) without an LLM available. */
function heuristicAiAssist(article: { title: string; abstract: string; keywords: string }): AiAssistResult {
  const sentences = article.abstract.split(/(?<=[.!?])\s+/).filter(Boolean);
  const laySummary = sentences.slice(0, 2).join(" ");

  const stopwords = new Set([
    "the", "and", "for", "with", "that", "this", "from", "into", "were", "was",
    "are", "have", "has", "using", "used", "our", "these", "their", "than",
    "across", "within", "between", "based", "which", "such", "over", "also",
  ]);
  const existing = new Set(
    article.keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean)
  );
  const freq = new Map<string, number>();
  for (const raw of article.abstract.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []) {
    if (stopwords.has(raw) || existing.has(raw)) continue;
    freq.set(raw, (freq.get(raw) ?? 0) + 1);
  }
  const suggestedKeywords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([w]) => w);

  return { laySummary, suggestedKeywords, mode: "heuristic", model: "heuristic-fallback" };
}
