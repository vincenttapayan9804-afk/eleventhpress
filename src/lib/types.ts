// Shared client-side types
import type { ArticleStatus } from "@/lib/article";

export interface ArticleListItem {
  id: string;
  doi: string | null;
  title: string;
  abstract: string;
  keywords: string;
  discipline: string;
  authors: string; // JSON string
  reviewModel: string;
  views: number;
  downloads: number;
  citations: number;
  publishedAt: string | null;
  volume: number | null;
  issueNumber: number | null;
  year: number | null;
  journalName?: string;
}

export interface ArticleDetail extends ArticleListItem {
  doiStatus: string;
  status: ArticleStatus;
  // RESEARCH | EXPERT_INSIGHT — see prisma/schema.prisma's Article.contentType.
  contentType?: string;
  insightCategory?: string | null;
  keyTakeaways?: string | null; // JSON array of exactly 5 strings, EXPERT_INSIGHT only
  manuscriptKey: string | null;
  galleyPdfKey: string | null;
  galleyHtmlKey: string | null;
  galleyJatsKey?: string | null;
  galleyEpubKey?: string | null;
  // One avatarUrl (or null) per parseAuthors(authors) entry, in the same
  // order — src/lib/author-accounts.ts resolveAuthorAvatars().
  authorAvatars?: (string | null)[];
  // AI glossary (src/lib/glossary.ts) — JSON [{term, definition}] / JSON
  // {mode, model, generatedAt}. glossaryMeta.mode "unavailable" means no
  // terms could be generated; show that honestly, not an empty list.
  glossary?: string | null;
  glossaryMeta?: string | null;
  plagiarismScore: number | null;
  ithenticateScore?: number | null;
  ithenticateReportUrl?: string | null;
  integrityStatus?: string;
  abstractTranslations?: string | null;
  funders?: string | null;
  laySummary?: string | null;
  submittedAt: string | null;
  acceptedAt: string | null;
  issueTitle: string | null;
  journalIssn: string | null;
  publisher: string | null;
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  affiliation?: string | null;
  expertise?: string | null;
  country?: string | null;
  orcid?: string | null;
  bio?: string | null;
}
