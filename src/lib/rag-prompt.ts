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

/** Cleans the model's usedPassages list into valid, de-duplicated numbers. */
export function normalizeUsedPassages(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
}
