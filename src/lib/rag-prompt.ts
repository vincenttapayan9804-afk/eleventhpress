import { parseAuthors } from "@/lib/article";

/**
 * Shared prompt pieces for the journal's retrieval-augmented chats
 * ("Ask the Corpus" and "Ask this paper"), so both enforce the same
 * grounding rules and give the model the same bibliographic record.
 */

/** Abstracts are included in full up to this length. */
const MAX_ABSTRACT_CHARS = 2000;
/** Each prior chat turn is truncated to this length in the prompt. */
const MAX_HISTORY_TURN_CHARS = 1500;

export interface ArticleRecord {
  id: string;
  title: string;
  authors: string;
  abstract: string;
  keywords: string;
  doi: string | null;
  publishedAt: Date | null;
  discipline: string;
}

/** Prisma `select` for the fields an ArticleRecord needs. */
export const ARTICLE_RECORD_SELECT = {
  id: true,
  title: true,
  authors: true,
  abstract: true,
  keywords: true,
  doi: true,
  publishedAt: true,
  discipline: true,
} as const;

/** One article's bibliographic record as plain text for the prompt. */
export function formatArticleRecord(a: ArticleRecord, label?: string): string {
  const authors = parseAuthors(a.authors)
    .map((au) => (au?.affiliation ? `${au.name} (${au.affiliation})` : au?.name))
    .filter(Boolean)
    .join("; ");
  const abstract =
    a.abstract && a.abstract.length > MAX_ABSTRACT_CHARS ? `${a.abstract.slice(0, MAX_ABSTRACT_CHARS)}…` : a.abstract;
  return [
    `${label ? `[${label}] ` : ""}"${a.title}"`,
    authors && `Authors: ${authors}`,
    a.publishedAt && `Published: ${a.publishedAt.toISOString().slice(0, 10)}`,
    a.doi && `DOI: ${a.doi}`,
    a.discipline && `Discipline: ${a.discipline}`,
    a.keywords && `Keywords: ${a.keywords}`,
    abstract && `Abstract: ${abstract}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Prior turns, clearly marked as context rather than a source of facts. */
export function formatHistory(history: ChatTurn[]): string {
  if (history.length === 0) return "";
  const lines = history.map(
    (t) => `${t.role === "user" ? "Reader" : "You"}: ${String(t.content ?? "").slice(0, MAX_HISTORY_TURN_CHARS)}`
  );
  return `\n\nPrior conversation (context only, not a source of facts; answer only from the journal records above):\n${lines.join("\n")}`;
}

/** The grounding rules every journal chat answer must follow. */
export const GROUNDING_RULES = [
  "Rules:",
  "1. Every factual statement must be supported by the records provided. Do not use outside knowledge, and do not fill gaps with plausible-sounding detail.",
  "2. Attribute each claim to its article by title. When a question is about one specific article, answer about that article only, and do not mix in findings from other articles unless the reader asks for a comparison.",
  "3. Reproduce numbers, statistics, sample sizes, dates, names and quotations exactly as written. Never round, convert or estimate them.",
  "4. If the records only partly answer the question, answer the part they support and say clearly what they don't cover. If they don't answer it at all, say so plainly and suggest rephrasing. Never guess.",
  "5. Be concise and well organised: lead with the direct answer, then supporting detail. Short paragraphs or bullet points are fine.",
  'Reply with only a JSON object: {"answer": string, "usedPassages": number[], "grounded": boolean}.',
  '"usedPassages" lists the passage numbers you drew on (use [] if you only used the article record).',
  '"grounded" is false only when the records do not answer the question.',
].join("\n");

/** Cleans the model's usedPassages list into valid, de-duplicated numbers. */
export function normalizeUsedPassages(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
}
