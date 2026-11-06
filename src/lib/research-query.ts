/**
 * Query understanding for the journal's AI Research Assistant ("Ask the
 * Corpus"): what kind of question this is, and whether it refers back to
 * articles discussed earlier in the conversation ("this article", "the
 * second study", "those findings", "the same author").
 *
 * Pure functions, so retrieval and prompting can be tested without a
 * database or a model.
 */
import { sectionRetrievalHints } from "@/lib/suggested-questions";

export type QuestionIntent = "bibliographic" | "comparison" | "overview" | "section" | "general";

export interface QuestionAnalysis {
  intent: QuestionIntent;
  /** The question points back at something discussed earlier. */
  refersToContext: boolean;
  /** 1-based position among the previous answer's sources ("the second
   * study"); -1 means the last one ("the latter"). */
  ordinal: number | null;
  /** "the same author", "other papers by them". */
  sameAuthor: boolean;
}

const COMPARISON =
  /\b(compar(e|es|ed|ing|ison|isons|ative)|contrast(s|ed|ing)?|versus|vs\.?|differ(s|ed|ence|ences|ent)?|similar(ity|ities)?|in common|across (the |these |those |all )?(studies|articles|papers|publications)|synthes(is|ise|ize|ised|ized)|conflict(s|ing)?|consensus|agree|disagree|both (studies|articles|papers)|each (study|article|paper)|relate to each other|between (the )?(studies|articles|papers))\b/i;
const OVERVIEW =
  /\b(what (topics|areas|themes|subjects|disciplines|fields)|overview|what does (this|the) journal|journal (cover|publish)|all (the )?(articles|papers|studies)|recent (articles|papers|studies|publications)|latest (articles|papers|studies|publications)|which (articles|papers|studies) (are|have|discuss|examine|address))\b/i;
const BIBLIOGRAPHIC =
  /\b(who (wrote|authored|are the authors)|author(s|ed)? of|when was .{0,80} published|publication date|published (on|in) (what|which)|doi|how (do|should) i cite|citation for|cite (this|it)|affiliat(ion|ed))\b/i;

/** "this article", "the previous study", "those findings", "its", "they". */
const CONTEXT_REFERENCE = new RegExp(
  [
    String.raw`\b(this|that|these|those|the same|the previous|the above|the earlier|the former|the latter|the first|the second|the third|the fourth|the fifth|the last|the other)\s+(article|articles|paper|papers|study|studies|research|work|author|authors|researchers?|findings?|results?|methods?|methodolog(y|ies)|designs?|samples?|respondents|participants|instruments?|ones?|conclusions?|recommendations?)\b`,
    String.raw`\bthe (study|paper|article|authors?|researchers?)\b`,
    String.raw`\bthe (former|latter)\b`,
    String.raw`\b(same author|same authors|same researchers?)\b`,
    String.raw`\b(above|aforementioned|mentioned)\b`,
  ].join("|"),
  "i"
);

/** Pronouns also often point back ("what were its limitations?"), but in
 * a longer question they usually refer to something within it ("how do
 * teachers rate their workload?"), so they only count in short questions. */
const PRONOUN_REFERENCE = /\b(it|its|their|theirs|they|them|he|she|his|her)\b/i;
const SHORT_QUESTION_WORDS = 12;

const ORDINALS: [RegExp, number][] = [
  [/\b(the )?(first|1st)\s+(article|paper|study|one|source|reference|methodology|method|design|approach|author)\b|\bthe first\b|\bthe former\b/i, 1],
  [/\b(the )?(second|2nd)\s+(article|paper|study|one|source|reference|methodology|method|design|approach|author)\b|\bthe second\b/i, 2],
  [/\b(the )?(third|3rd)\s+(article|paper|study|one|source|reference|methodology|method|design|approach|author)\b|\bthe third\b/i, 3],
  [/\b(the )?(fourth|4th)\s+(article|paper|study|one|source|reference|methodology|method|design|approach|author)\b|\bthe fourth\b/i, 4],
  [/\b(the )?(fifth|5th)\s+(article|paper|study|one|source|reference|methodology|method|design|approach|author)\b|\bthe fifth\b/i, 5],
  [/\bthe (latter|last (article|paper|study|one|source|methodology|method|design|approach))\b/i, -1],
];

const SAME_AUTHOR =
  /\b(same|that|this|those|these) (author|authors|researcher|researchers)\b|\bother (articles|papers|works|studies|publications) by\b|\b(he|she|they) (also )?(wrote|published|authored)\b|\bby (him|her|them)\b/i;

export function analyzeQuestion(question: string): QuestionAnalysis {
  const q = question.trim();
  let intent: QuestionIntent = "general";
  if (COMPARISON.test(q)) intent = "comparison";
  else if (BIBLIOGRAPHIC.test(q)) intent = "bibliographic";
  else if (sectionRetrievalHints(q)) intent = "section";
  else if (OVERVIEW.test(q)) intent = "overview";

  let ordinal: number | null = null;
  for (const [re, n] of ORDINALS) {
    if (re.test(q)) {
      ordinal = n;
      break;
    }
  }
  const sameAuthor = SAME_AUTHOR.test(q);
  const short = q.split(/\s+/).filter(Boolean).length <= SHORT_QUESTION_WORDS;
  const refersToContext =
    ordinal !== null || sameAuthor || CONTEXT_REFERENCE.test(q) || (short && PRONOUN_REFERENCE.test(q));
  return { intent, refersToContext, ordinal, sameAuthor };
}

/** A prior turn as the client sends it: assistant turns list the article
 * ids their answer cited, in reference order. */
export interface ContextTurn {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

const ARTICLE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Cleans client-supplied source ids: strings that look like ids, no
 * duplicates, at most `max`. */
export function cleanSourceIds(raw: unknown, max = 8): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v === "string" && ARTICLE_ID.test(v) && !out.includes(v)) out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * The articles a follow-up question refers to: the specific one an ordinal
 * picks out ("the second study" → the previous answer's second source),
 * otherwise the previous answer's sources, most-cited first. Empty when
 * the question doesn't refer back.
 */
export function resolveContextArticles(analysis: QuestionAnalysis, history: ContextTurn[], max = 3): string[] {
  if (!analysis.refersToContext) return [];
  const previous = [...history].reverse().find((t) => t?.role === "assistant" && cleanSourceIds(t.sources).length > 0);
  if (!previous) return [];
  const sources = cleanSourceIds(previous.sources);
  if (analysis.ordinal !== null) {
    const pick = analysis.ordinal === -1 ? sources[sources.length - 1] : sources[analysis.ordinal - 1];
    if (pick) return [pick];
  }
  // A comparison follow-up ("how do those findings compare?") keeps every
  // source in play; anything else concentrates on the main ones.
  return sources.slice(0, analysis.intent === "comparison" ? Math.max(max, 4) : max);
}

/** Retrieval settings for each kind of question. */
export function retrievalPlan(analysis: QuestionAnalysis): { limit: number; maxFocused: number; maxPerArticle: number } {
  switch (analysis.intent) {
    case "comparison":
      // Wider and more even: several articles, a few passages each.
      return { limit: 14, maxFocused: 4, maxPerArticle: 3 };
    case "overview":
      return { limit: 12, maxFocused: 2, maxPerArticle: 2 };
    case "bibliographic":
      return { limit: 6, maxFocused: 2, maxPerArticle: 3 };
    default:
      return { limit: 10, maxFocused: 2, maxPerArticle: 3 };
  }
}
