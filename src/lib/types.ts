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
  manuscriptKey: string | null;
  galleyPdfKey: string | null;
  galleyHtmlKey: string | null;
  plagiarismScore: number | null;
  ithenticateScore?: number | null;
  ithenticateReportUrl?: string | null;
  integrityStatus?: string;
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
