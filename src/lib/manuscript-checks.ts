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
import { chatJSON, isLLMAvailable } from "@/lib/llm";
import { generateEmbedding } from "@/lib/embeddings";

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

function cosineSimilarity(a: number[], b: number[]): number {
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
  if (isLLMAvailable()) {
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
  if (isLLMAvailable()) {
    try {
      const { data, model } = await chatJSON<{ laySummary: string; suggestedKeywords: string[] }>(
        AI_ASSIST_SYSTEM_PROMPT,
        `Title: ${article.title}\n\nAbstract:\n${article.abstract}\n\nExisting keywords: ${article.keywords || "(none)"}`,
        { maxTokens: 1000 }
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
