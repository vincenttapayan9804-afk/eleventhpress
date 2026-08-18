/**
 * Executive Command Intelligence Phase 3 — Institutional Reputation
 * Intelligence.
 *
 * Answers a different board-meeting question than Phase 1 (peer volume
 * comparison) or Phase 2 (own trend/compliance): "is our research
 * enterprise reputable?" — editorial rigor, indexing/directory legitimacy,
 * post-publication integrity record, and reviewer network depth. One
 * tenant's own real numbers only, same posture as Phase 2 — no
 * cross-tenant comparison here either. Deliberately never produces a
 * fabricated single "reputation score": every number below is a real,
 * live-computed count or rate, same discipline as research-benchmark.ts
 * and board-intelligence.ts.
 */
import type { ExtendedTransactionClient } from "@/lib/db-rls";

export interface EditorialRigor {
  submitted: number;
  accepted: number;
  rejected: number;
  underReview: number;
  acceptanceRate: number; // accepted / (accepted + rejected), 0 if none decided yet
  avgDecisionDays: number | null; // submittedAt -> decision date, across accepted + rejected
}

export interface DirectoryStatusCounts {
  directory: string;
  indexed: number;
  applied: number; // APPLIED or UNDER_REVIEW
  rejected: number;
  notApplied: number;
}

export interface IndexingSummary {
  totalJournals: number;
  directories: DirectoryStatusCounts[];
  indexedListingCount: number;
  totalListingCount: number; // rows with a real application on file (excludes NOT_APPLIED)
}

export interface IntegrityRecord {
  publishedArticles: number;
  normal: number;
  corrected: number;
  underConcern: number;
  retracted: number;
  cleanRecordRate: number; // normal / publishedArticles, 1 if no published articles
}

export interface ReviewerNetwork {
  distinctReviewers: number;
  completedReviews: number;
  avgReviewerScore: number | null; // 1-5, among completed reviews with a score on file
  avgReviewTurnaroundDays: number | null; // createdAt -> completedAt, completed reviews only
}

export interface ReputationIntelligenceResult {
  tenantId: string;
  editorialRigor: EditorialRigor;
  indexing: IndexingSummary;
  integrity: IntegrityRecord;
  reviewerNetwork: ReviewerNetwork;
}

const DIRECTORIES = ["ROAD", "ISI", "RESEARCHBIB", "CITEFACTOR", "SAJI"] as const;

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 86_400_000;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

export async function computeReputationIntelligence(tx: ExtendedTransactionClient, tenantId: string): Promise<ReputationIntelligenceResult> {
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const journals = await tx.journal.findMany({ where: { tenantId }, select: { id: true } });
  const journalIds = journals.map((j) => j.id);

  const [articles, rejectDecisions, listings, reviews] = await Promise.all([
    tx.article.findMany({
      where: { journalId: { in: journalIds } },
      select: { id: true, status: true, submittedAt: true, acceptedAt: true, integrityStatus: true },
    }),
    tx.editorialDecision.findMany({
      where: { decision: "REJECT", article: { journalId: { in: journalIds } } },
      select: { articleId: true, createdAt: true, article: { select: { submittedAt: true } } },
    }),
    tx.directoryListing.findMany({ where: { journalId: { in: journalIds } }, select: { directory: true, status: true } }),
    tx.review.findMany({
      where: { article: { journalId: { in: journalIds } } },
      select: { reviewerId: true, status: true, overallScore: true, createdAt: true, completedAt: true },
    }),
  ]);

  // --- Editorial rigor ---
  const submitted = articles.filter((a) => a.submittedAt !== null).length;
  const accepted = articles.filter((a) => a.acceptedAt !== null).length;
  const rejected = articles.filter((a) => a.status === "REJECTED").length;
  const underReview = articles.filter((a) => a.status === "SUBMITTED" || a.status === "UNDER_REVIEW" || a.status === "REVISIONS_REQUIRED").length;
  const acceptanceRate = accepted + rejected > 0 ? Math.round((accepted / (accepted + rejected)) * 1000) / 1000 : 0;

  const decisionDurations: number[] = [];
  for (const a of articles) {
    if (a.acceptedAt && a.submittedAt) decisionDurations.push(daysBetween(a.submittedAt, a.acceptedAt));
  }
  for (const d of rejectDecisions) {
    if (d.article?.submittedAt) decisionDurations.push(daysBetween(d.article.submittedAt, d.createdAt));
  }
  const avgDecisionDays = average(decisionDurations);

  const editorialRigor: EditorialRigor = { submitted, accepted, rejected, underReview, acceptanceRate, avgDecisionDays };

  // --- Indexing / directory coverage ---
  const directories: DirectoryStatusCounts[] = DIRECTORIES.map((directory) => {
    const rows = listings.filter((l) => l.directory === directory);
    return {
      directory,
      indexed: rows.filter((r) => r.status === "INDEXED").length,
      applied: rows.filter((r) => r.status === "APPLIED" || r.status === "UNDER_REVIEW").length,
      rejected: rows.filter((r) => r.status === "REJECTED").length,
      notApplied: journalIds.length - rows.length + rows.filter((r) => r.status === "NOT_APPLIED").length,
    };
  });
  const indexedListingCount = listings.filter((l) => l.status === "INDEXED").length;
  const totalListingCount = listings.filter((l) => l.status !== "NOT_APPLIED").length;

  const indexing: IndexingSummary = { totalJournals: journalIds.length, directories, indexedListingCount, totalListingCount };

  // --- Post-publication integrity record ---
  const published = articles.filter((a) => a.status === "PUBLISHED");
  const normal = published.filter((a) => a.integrityStatus === "NORMAL").length;
  const corrected = published.filter((a) => a.integrityStatus === "CORRECTED").length;
  const underConcern = published.filter((a) => a.integrityStatus === "UNDER_CONCERN").length;
  const retracted = published.filter((a) => a.integrityStatus === "RETRACTED").length;
  const cleanRecordRate = published.length > 0 ? Math.round((normal / published.length) * 1000) / 1000 : 1;

  const integrity: IntegrityRecord = { publishedArticles: published.length, normal, corrected, underConcern, retracted, cleanRecordRate };

  // --- Reviewer network ---
  const distinctReviewers = new Set(reviews.map((r) => r.reviewerId)).size;
  const completed = reviews.filter((r) => r.status === "COMPLETED");
  const avgReviewerScore = average(completed.map((r) => r.overallScore).filter((s): s is number => s !== null));
  const avgReviewTurnaroundDays = average(completed.filter((r) => r.completedAt).map((r) => daysBetween(r.createdAt, r.completedAt!)));

  const reviewerNetwork: ReviewerNetwork = { distinctReviewers, completedReviews: completed.length, avgReviewerScore, avgReviewTurnaroundDays };

  return { tenantId, editorialRigor, indexing, integrity, reviewerNetwork };
}
