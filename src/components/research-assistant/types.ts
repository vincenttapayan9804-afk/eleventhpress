import type { AnswerCitation, AnswerSource, EvidenceCheck } from "@/lib/answer-integrity";
import type { QuestionIntent } from "@/lib/research-query";
import type { StarterPrompt } from "@/lib/suggested-questions";

export type { AnswerCitation, AnswerSource, EvidenceCheck, QuestionIntent, StarterPrompt };

export interface SectionQuestion {
  section: string;
  question: string;
}

/** How much of the corpus an answer stands on. */
export interface AnswerCoverage {
  level: "strong" | "partial" | "limited" | "none";
  citedArticles: number;
  articlesReviewed: number;
  corpusArticles: number | null;
  /** The reader's scope in words ("Education; published 2022–2024"), or null for the whole journal. */
  scope: string | null;
}

/** Questions left this hour (only when limits are enforced). */
export interface AssistantQuota {
  limit: number;
  remaining: number;
  resetAt: string;
  basis: "account" | "network";
}

/** The part of the journal a question searches; empty = the whole journal. */
export interface CorpusScope {
  disciplines?: string[];
  yearFrom?: number;
  yearTo?: number;
  issueId?: string;
  articleIds?: string[];
}

export interface ScopeFacets {
  disciplines: string[];
  years: { min: number; max: number } | null;
  issues: { id: string; label: string }[];
}

/** Everything the API returns with an answer, kept with the message. */
export interface AnswerData {
  grounded: boolean;
  intent?: QuestionIntent;
  citations: AnswerCitation[];
  sources: AnswerSource[];
  evidence?: EvidenceCheck & { passagesReviewed?: number; articlesReviewed?: number };
  evidenceIds?: string[];
  coverage?: AnswerCoverage;
  /** The scope the question was asked in (so "Edit and resend" keeps it). */
  scope?: CorpusScope | null;
  /** This answer continued the analysis of an earlier question. */
  continued?: string | null;
  suggestedQuestions?: string[];
  sectionQuestions?: SectionQuestion[];
  sectionArticle?: string | null;
  sectionArticleId?: string | null;
  model?: string;
  answeredAt?: string;
  feedback?: "HELPFUL" | "NOT_HELPFUL";
  reported?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  saved?: boolean;
  /** Collection a saved response is filed in. */
  folder?: string | null;
  data?: AnswerData;
}

export interface ConversationSummary {
  id: string;
  title: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  /** A read-only share link exists. */
  shared?: boolean;
  /** Matching text, for search results. */
  match?: string;
}

export interface Conversation extends ConversationSummary {
  messages: ChatMessage[];
  shareToken?: string | null;
}

export interface SavedResponse {
  id: string;
  conversationId: string;
  conversationTitle: string;
  content: string;
  /** The question this response answered. */
  question?: string;
  createdAt: string;
  folder?: string | null;
  data?: AnswerData;
}

export interface JournalMasthead {
  name: string;
  issn: string | null;
  publisher: string;
}

export const INTENT_LABEL: Record<QuestionIntent, string> = {
  bibliographic: "Bibliographic lookup",
  section: "Paper section",
  comparison: "Comparative analysis",
  overview: "Journal overview",
  general: "Research answer",
};
