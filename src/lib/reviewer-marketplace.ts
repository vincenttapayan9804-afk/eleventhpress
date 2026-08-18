/**
 * Executive Command Intelligence Phase 4 — Reviewer Marketplace
 * Intelligence.
 *
 * Phases 1-3 all look outward or upward from the research enterprise
 * (peer comparison, trend/compliance, reputation). Phase 4 turns inward on
 * the two-sided marketplace that makes peer review possible at all: is the
 * reviewer pool big enough, responsive enough, and evenly loaded enough to
 * keep the editorial pipeline moving? Every figure is a live count/rate
 * over `Review`/`User` — never a fabricated "marketplace health score,"
 * same "never an estimate" posture as research-benchmark.ts,
 * board-intelligence.ts, and reputation-intelligence.ts.
 */
import type { ExtendedTransactionClient } from "@/lib/db-rls";

export interface InvitationFunnel {
  invited: number;
  accepted: number;
  declined: number;
  inProgress: number;
  completed: number;
  responseRate: number; // (accepted+declined+inProgress+completed) / total, i.e. share of invites resolved either way
  declineRate: number; // declined / (declined+accepted+inProgress+completed)
  completionRate: number; // completed / (accepted+inProgress+completed)
}

export interface WorkloadBucket {
  label: string; // "1", "2-3", "4-6", "7+"
  reviewerCount: number;
}

export interface WorkloadDistribution {
  buckets: WorkloadBucket[];
  overloadedReviewerCount: number; // reviewers currently carrying 5+ active (accepted/in-progress) assignments
}

export interface TimelinessSummary {
  overdueCount: number; // active (accepted/in-progress) reviews past dueDate, not yet completed
  onTimeCompletionRate: number | null; // among completed reviews with a dueDate, share completed at/before it
}

export interface ExpertiseKeyword {
  keyword: string;
  reviewerCount: number;
}

export interface ExpertiseCoverage {
  distinctKeywordCount: number;
  topKeywords: ExpertiseKeyword[];
}

export interface ReviewerMarketplaceResult {
  tenantId: string;
  poolSize: number; // distinct reviewers ever invited across the tenant's journals
  activeReviewerCount: number; // distinct reviewers who completed a review in the last 180 days
  funnel: InvitationFunnel;
  workload: WorkloadDistribution;
  timeliness: TimelinessSummary;
  expertise: ExpertiseCoverage;
}

const ACTIVE_WINDOW_DAYS = 180;
const OVERLOAD_THRESHOLD = 5;

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 100) / 100;
}

export async function computeReviewerMarketplace(tx: ExtendedTransactionClient, tenantId: string): Promise<ReviewerMarketplaceResult> {
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) throw new Error("Tenant not found");

  const journals = await tx.journal.findMany({ where: { tenantId }, select: { id: true } });
  const journalIds = journals.map((j) => j.id);

  const reviews = await tx.review.findMany({
    where: { article: { journalId: { in: journalIds } } },
    select: { reviewerId: true, status: true, dueDate: true, createdAt: true, completedAt: true },
  });

  const reviewerIds = Array.from(new Set(reviews.map((r) => r.reviewerId)));
  const reviewers = await tx.user.findMany({
    where: { id: { in: reviewerIds } },
    select: { id: true, expertise: true },
  });

  // --- Funnel ---
  const invited = reviews.length;
  const declined = reviews.filter((r) => r.status === "DECLINED").length;
  const accepted = reviews.filter((r) => r.status === "ACCEPTED").length;
  const inProgress = reviews.filter((r) => r.status === "IN_PROGRESS").length;
  const completed = reviews.filter((r) => r.status === "COMPLETED").length;
  const resolved = declined + accepted + inProgress + completed;
  const funnel: InvitationFunnel = {
    invited,
    accepted,
    declined,
    inProgress,
    completed,
    responseRate: rate(resolved, invited),
    declineRate: rate(declined, resolved),
    completionRate: rate(completed, accepted + inProgress + completed),
  };

  // --- Workload distribution (active = ACCEPTED or IN_PROGRESS) ---
  const activeCountByReviewer = new Map<string, number>();
  for (const r of reviews) {
    if (r.status === "ACCEPTED" || r.status === "IN_PROGRESS") {
      activeCountByReviewer.set(r.reviewerId, (activeCountByReviewer.get(r.reviewerId) ?? 0) + 1);
    }
  }
  const bucketCounts = { "1": 0, "2-3": 0, "4-6": 0, "7+": 0 };
  let overloadedReviewerCount = 0;
  for (const count of activeCountByReviewer.values()) {
    if (count >= 1 && count <= 1) bucketCounts["1"]++;
    else if (count >= 2 && count <= 3) bucketCounts["2-3"]++;
    else if (count >= 4 && count <= 6) bucketCounts["4-6"]++;
    else if (count >= 7) bucketCounts["7+"]++;
    if (count >= OVERLOAD_THRESHOLD) overloadedReviewerCount++;
  }
  const workload: WorkloadDistribution = {
    buckets: [
      { label: "1", reviewerCount: bucketCounts["1"] },
      { label: "2-3", reviewerCount: bucketCounts["2-3"] },
      { label: "4-6", reviewerCount: bucketCounts["4-6"] },
      { label: "7+", reviewerCount: bucketCounts["7+"] },
    ],
    overloadedReviewerCount,
  };

  // --- Timeliness ---
  const now = new Date();
  const overdueCount = reviews.filter(
    (r) => (r.status === "ACCEPTED" || r.status === "IN_PROGRESS") && r.dueDate !== null && r.dueDate < now
  ).length;
  const completedWithDueDate = reviews.filter((r) => r.status === "COMPLETED" && r.dueDate !== null && r.completedAt !== null);
  const onTimeCompletionRate =
    completedWithDueDate.length === 0
      ? null
      : rate(completedWithDueDate.filter((r) => r.completedAt! <= r.dueDate!).length, completedWithDueDate.length);
  const timeliness: TimelinessSummary = { overdueCount, onTimeCompletionRate };

  // --- Active reviewer count (completed a review in the active window) ---
  const activeCutoff = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * 86_400_000);
  const activeReviewerCount = new Set(
    reviews.filter((r) => r.status === "COMPLETED" && r.completedAt !== null && r.completedAt >= activeCutoff).map((r) => r.reviewerId)
  ).size;

  // --- Expertise coverage (among reviewers who have ever been invited) ---
  const keywordCounts = new Map<string, number>();
  for (const reviewer of reviewers) {
    if (!reviewer.expertise) continue;
    const keywords = new Set(
      reviewer.expertise
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter((k) => k.length > 0)
    );
    for (const keyword of keywords) {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1);
    }
  }
  const topKeywords = Array.from(keywordCounts.entries())
    .map(([keyword, reviewerCount]) => ({ keyword, reviewerCount }))
    .sort((a, b) => b.reviewerCount - a.reviewerCount)
    .slice(0, 8);
  const expertise: ExpertiseCoverage = { distinctKeywordCount: keywordCounts.size, topKeywords };

  return {
    tenantId,
    poolSize: reviewerIds.length,
    activeReviewerCount,
    funnel,
    workload,
    timeliness,
    expertise,
  };
}
