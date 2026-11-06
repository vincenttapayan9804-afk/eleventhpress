import type { AnswerCitation, AnswerSource, EvidenceCheck } from "@/lib/answer-integrity";
import type { QuestionIntent } from "@/lib/research-query";
import type { StarterPrompt } from "@/lib/suggested-questions";

export type { AnswerCitation, AnswerSource, EvidenceCheck, QuestionIntent, StarterPrompt };

export interface SectionQuestion {
  section: string;
  question: string;
}

/** Everything the API returns with an answer, kept with the message. */
export interface AnswerData {
  grounded: boolean;
  intent?: QuestionIntent;
  citations: AnswerCitation[];
  sources: AnswerSource[];
  evidence?: EvidenceCheck & { passagesReviewed?: number; articlesReviewed?: number };
  evidenceIds?: string[];
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
  data?: AnswerData;
}

export interface ConversationSummary {
  id: string;
  title: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  /** Matching text, for search results. */
  match?: string;
}

export interface Conversation extends ConversationSummary {
  messages: ChatMessage[];
}

export interface SavedResponse {
  id: string;
  conversationId: string;
  conversationTitle: string;
  content: string;
  createdAt: string;
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
