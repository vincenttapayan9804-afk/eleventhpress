/**
 * Executive Command Intelligence Phase 2 — Board-Level Research Intelligence.
 *
 * Where Phase 1 (research-benchmark.ts) answers "how do we compare to
 * similar-sized peers right now," this answers the board-meeting question:
 * "how is our research enterprise trending, and where are the compliance
 * risks?" A single tenant's own real numbers only — no cross-tenant data,
 * unlike Phase 1's peer aggregate (there's nothing to anonymize here since
 * nothing is compared across tenants).
 *
 * Every figure is a live count over Article/Grant/Patent/EthicsSubmission —
 * never an estimate, same posture as research-benchmark.ts.
 */
import type { ExtendedTransactionClient } from "@/lib/db-rls";

export interface BoardHeadline {
  publications: number;
  citations: number;
  fundingTotal: number; // sum of Grant.amount, mixed-currency (see caveat in UI label)
  activeGrants: number;
  patentCount: number;
  activeResearchers: number; // distinct corresponding-author users on published articles
}

export interface QuarterPoint {
  period: string; // e.g. "2025-Q3"
  count: number;
}

export interface FundingQuarterPoint {
  period: string;
  amount: number;
}

export interface DisciplineShare {
  discipline: string;
  count: number;
}

export interface EthicsCompliance {
  submitted: number;
  approved: number;
  rejected: number;
  pending: number; // SUBMITTED + UNDER_REVIEW
  approvalRate: number; // approved / (approved + rejected), 0 if none decided yet
  avgTurnaroundDays: number | null; // avg(reviewedAt - submittedAt) over decided submissions; null if none decided
}

export interface BoardIntelligenceResult {
  tenantId: string;
  headline: BoardHeadline;
  publicationTrend: QuarterPoint[];
  fundingTrend: FundingQuarterPoint[];
  topDisciplines: DisciplineShare[];
  ethicsCompliance: EthicsCompliance;
}

const TREND_QUARTERS = 6;

function quarterKey(d: Date): string {
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${d.getUTCFullYear()}-Q${q}`;
}

/** The last `n` quarters, oldest first, ending with the current quarter. */
function lastNQuarters(n: number): string[] {
  const now = new Date();
  let year = now.getUTCFullYear();
  let quarter = Math.floor(now.getUTCMonth() / 3) + 1;
  const keys: string[] = [];
  for (let i = 0; i < n; i++) {
    keys.unshift(`${year}-Q${quarter}`);
    quarter -= 1;
    if (quarter === 0) {
      quarter = 4;
      year -= 1;
    }
  }
  return keys;
}

/**
 * Computes board-level intelligence for one tenant. Call inside
 * withRlsContext (see /api/admin/board-intelligence), same as
 * computeTenantBenchmark.
 */
export async function computeBoardIntelligence(tx: ExtendedTransactionClient, tenantId: string): Promise<BoardIntelligenceResult> {
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const [articles, grants, patentCount, ethicsSubmissions] = await Promise.all([
    tx.article.findMany({
      where: { status: "PUBLISHED", journal: { tenantId } },
      select: { publishedAt: true, discipline: true, citations: true, correspondingAuthorId: true },
    }),
    tx.grant.findMany({ where: { tenantId }, select: { amount: true, status: true, createdAt: true } }),
    tx.patent.count({ where: { tenantId } }),
    tx.ethicsSubmission.findMany({ where: { tenantId }, select: { status: true, submittedAt: true, reviewedAt: true } }),
  ]);

  const citations = articles.reduce((sum, a) => sum + a.citations, 0);
  const activeResearchers = new Set(articles.map((a) => a.correspondingAuthorId).filter((id): id is string => !!id)).size;
  const fundingTotal = grants.reduce((sum, g) => sum + (g.amount ?? 0), 0);
  const activeGrants = grants.filter((g) => g.status === "ACTIVE").length;

  const headline: BoardHeadline = {
    publications: articles.length,
    citations,
    fundingTotal,
    activeGrants,
    patentCount,
    activeResearchers,
  };

  const quarters = lastNQuarters(TREND_QUARTERS);
  const pubByQuarter = new Map(quarters.map((q) => [q, 0]));
  for (const a of articles) {
    if (!a.publishedAt) continue;
    const key = quarterKey(a.publishedAt);
    if (pubByQuarter.has(key)) pubByQuarter.set(key, (pubByQuarter.get(key) ?? 0) + 1);
  }
  const publicationTrend: QuarterPoint[] = quarters.map((period) => ({ period, count: pubByQuarter.get(period) ?? 0 }));

  const fundingByQuarter = new Map(quarters.map((q) => [q, 0]));
  for (const g of grants) {
    const key = quarterKey(g.createdAt);
    if (fundingByQuarter.has(key)) fundingByQuarter.set(key, (fundingByQuarter.get(key) ?? 0) + (g.amount ?? 0));
  }
  const fundingTrend: FundingQuarterPoint[] = quarters.map((period) => ({ period, amount: fundingByQuarter.get(period) ?? 0 }));

  const disciplineCounts = new Map<string, number>();
  for (const a of articles) {
    if (!a.discipline) continue;
    disciplineCounts.set(a.discipline, (disciplineCounts.get(a.discipline) ?? 0) + 1);
  }
  const topDisciplines: DisciplineShare[] = [...disciplineCounts.entries()]
    .map(([discipline, count]) => ({ discipline, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const approved = ethicsSubmissions.filter((s) => s.status === "APPROVED");
  const rejected = ethicsSubmissions.filter((s) => s.status === "REJECTED");
  const pending = ethicsSubmissions.filter((s) => s.status === "SUBMITTED" || s.status === "UNDER_REVIEW").length;
  const decided = [...approved, ...rejected].filter((s) => s.reviewedAt);
  const avgTurnaroundDays =
    decided.length > 0
      ? Math.round(
          (decided.reduce((sum, s) => sum + (s.reviewedAt!.getTime() - s.submittedAt.getTime()), 0) / decided.length / (1000 * 60 * 60 * 24)) * 10,
        ) / 10
      : null;

  const ethicsCompliance: EthicsCompliance = {
    submitted: ethicsSubmissions.length,
    approved: approved.length,
    rejected: rejected.length,
    pending,
    approvalRate: approved.length + rejected.length > 0 ? Math.round((approved.length / (approved.length + rejected.length)) * 100) / 100 : 0,
    avgTurnaroundDays,
  };

  return { tenantId, headline, publicationTrend, fundingTrend, topDisciplines, ethicsCompliance };
}
