/**
 * Executive Command Intelligence Phase 5 — Research Board Intelligence.
 *
 * Phases 1-4 look at the research enterprise's outputs, trends, reputation,
 * and reviewer capacity. Phase 5 turns to the editorial board itself — the
 * humans making ACCEPT/REJECT/REVISIONS calls: how many are active, how
 * fast do they turn around a first decision, what's the outcome mix, and is
 * the current active caseload evenly spread? Built entirely from
 * `EditorialDecision` (already the platform's decision-of-record log) and
 * `Article.submittedAt/status`. One tenant's own real numbers only, same
 * posture as Phases 2-4 — no cross-tenant comparison.
 *
 * Deliberately no per-editor naming or leaderboard (same non-goal as Phase
 * 4's reviewer workload view) — this is board capacity planning, not a
 * performance review. Deliberately no fabricated composite "board health
 * score" — every figure is a real, live-computed count or rate.
 */
import type { ExtendedTransactionClient } from "@/lib/db-rls";

export interface DecisionTypeCount {
  decision: string;
  count: number;
}

export interface DecisionFunnel {
  total: number;
  byType: DecisionTypeCount[];
  acceptRate: number; // ACCEPT / (ACCEPT + REJECT), 0 if neither has happened yet
  revisionRate: number; // REQUEST_REVISIONS / total
}

export interface BoardComposition {
  distinctEditorCount: number; // ever made a decision
  activeEditorCount: number; // made a decision in the active window
}

export interface TimelinessSummary {
  avgDaysToFirstDecision: number | null; // over articles that have received at least one decision
  awaitingFirstDecisionCount: number; // SUBMITTED/UNDER_REVIEW articles with zero decisions yet
  avgDaysAwaitingFirstDecision: number | null; // among those still waiting, avg days since submission
}

export interface CaseloadBucket {
  label: string;
  editorCount: number;
}

export interface CaseloadDistribution {
  buckets: CaseloadBucket[];
  overloadedEditorCount: number;
  unassignedActiveCount: number; // active-status articles with no decision yet, so no editor of record
}

export interface ResearchBoardIntelligenceResult {
  tenantId: string;
  composition: BoardComposition;
  funnel: DecisionFunnel;
  timeliness: TimelinessSummary;
  caseload: CaseloadDistribution;
}

const ACTIVE_WINDOW_DAYS = 90;
const OVERLOAD_THRESHOLD = 5;
// The board is still actively deciding an article's fate in these states —
// once ACCEPTED/IN_PRODUCTION/PUBLISHED/REJECTED/WITHDRAWN, it has left the
// editor's active caseload.
const ACTIVE_EDITORIAL_STATUSES = new Set(["SUBMITTED", "UNDER_REVIEW", "REVISIONS_REQUIRED"]);

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 100) / 100;
}

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 86_400_000;
}

export async function computeResearchBoardIntelligence(tx: ExtendedTransactionClient, tenantId: string): Promise<ResearchBoardIntelligenceResult> {
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) throw new Error("Tenant not found");

  const journals = await tx.journal.findMany({ where: { tenantId }, select: { id: true } });
  const journalIds = journals.map((j) => j.id);

  const articles = await tx.article.findMany({
    where: { journalId: { in: journalIds } },
    select: { id: true, status: true, submittedAt: true },
  });
  const articlesById = new Map(articles.map((a) => [a.id, a]));

  const decisions = await tx.editorialDecision.findMany({
    where: { articleId: { in: articles.map((a) => a.id) } },
    select: { articleId: true, editorId: true, decision: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Composition
  const now = new Date();
  const activeCutoff = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * 86_400_000);
  const editorIds = new Set(decisions.map((d) => d.editorId));
  const activeEditorIds = new Set(decisions.filter((d) => d.createdAt >= activeCutoff).map((d) => d.editorId));
  const composition: BoardComposition = { distinctEditorCount: editorIds.size, activeEditorCount: activeEditorIds.size };

  // Funnel
  const typeCounts = new Map<string, number>();
  for (const d of decisions) {
    typeCounts.set(d.decision, (typeCounts.get(d.decision) ?? 0) + 1);
  }
  const accept = typeCounts.get("ACCEPT") ?? 0;
  const reject = typeCounts.get("REJECT") ?? 0;
  const revisions = typeCounts.get("REQUEST_REVISIONS") ?? 0;
  const funnel: DecisionFunnel = {
    total: decisions.length,
    byType: Array.from(typeCounts.entries())
      .map(([decision, count]) => ({ decision, count }))
      .sort((a, b) => b.count - a.count),
    acceptRate: rate(accept, accept + reject),
    revisionRate: rate(revisions, decisions.length),
  };

  // First-decision timeliness
  const firstDecisionByArticle = new Map<string, Date>();
  for (const d of decisions) {
    if (!firstDecisionByArticle.has(d.articleId)) firstDecisionByArticle.set(d.articleId, d.createdAt);
  }
  const decidedDurations: number[] = [];
  for (const [articleId, firstDecidedAt] of firstDecisionByArticle) {
    const article = articlesById.get(articleId);
    if (!article?.submittedAt) continue;
    decidedDurations.push(daysBetween(article.submittedAt, firstDecidedAt));
  }
  const avgDaysToFirstDecision =
    decidedDurations.length === 0 ? null : Math.round((decidedDurations.reduce((s, v) => s + v, 0) / decidedDurations.length) * 10) / 10;

  const awaitingFirstDecision = articles.filter(
    (a) => ACTIVE_EDITORIAL_STATUSES.has(a.status) && a.submittedAt !== null && !firstDecisionByArticle.has(a.id),
  );
  const avgDaysAwaitingFirstDecision =
    awaitingFirstDecision.length === 0
      ? null
      : Math.round((awaitingFirstDecision.reduce((s, a) => s + daysBetween(a.submittedAt!, now), 0) / awaitingFirstDecision.length) * 10) / 10;

  const timeliness: TimelinessSummary = {
    avgDaysToFirstDecision,
    awaitingFirstDecisionCount: awaitingFirstDecision.length,
    avgDaysAwaitingFirstDecision,
  };

  // Caseload: for each active-status article with a decision, attribute it
  // to the editor of its most recent decision.
  const latestEditorByArticle = new Map<string, string>();
  for (const d of decisions) {
    latestEditorByArticle.set(d.articleId, d.editorId); // decisions are ordered asc, so the last write wins
  }
  const activeCaseByEditor = new Map<string, number>();
  let unassignedActiveCount = 0;
  for (const a of articles) {
    if (!ACTIVE_EDITORIAL_STATUSES.has(a.status)) continue;
    const editorId = latestEditorByArticle.get(a.id);
    if (!editorId) {
      unassignedActiveCount++;
      continue;
    }
    activeCaseByEditor.set(editorId, (activeCaseByEditor.get(editorId) ?? 0) + 1);
  }
  const bucketCounts = { "1": 0, "2-3": 0, "4-6": 0, "7+": 0 };
  let overloadedEditorCount = 0;
  for (const count of activeCaseByEditor.values()) {
    if (count === 1) bucketCounts["1"]++;
    else if (count >= 2 && count <= 3) bucketCounts["2-3"]++;
    else if (count >= 4 && count <= 6) bucketCounts["4-6"]++;
    else if (count >= 7) bucketCounts["7+"]++;
    if (count >= OVERLOAD_THRESHOLD) overloadedEditorCount++;
  }
  const caseload: CaseloadDistribution = {
    buckets: [
      { label: "1", editorCount: bucketCounts["1"] },
      { label: "2-3", editorCount: bucketCounts["2-3"] },
      { label: "4-6", editorCount: bucketCounts["4-6"] },
      { label: "7+", editorCount: bucketCounts["7+"] },
    ],
    overloadedEditorCount,
    unassignedActiveCount,
  };

  return { tenantId, composition, funnel, timeliness, caseload };
}
