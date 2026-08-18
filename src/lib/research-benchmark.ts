/**
 * Executive Command Intelligence Phase 1 — Research Benchmarking.
 *
 * Answers "how does our research ecosystem compare with institutions of
 * similar size?" with real, live-computed counts against Article/Grant/
 * Patent/DatasetLink/User — never an estimate, same posture as
 * research-lab-activity.ts and the RankingsTab/ResearchDashboardTab
 * comparisons this reuses the pattern from.
 *
 * "Similar size" is a real, documented bucket (PEER_BANDS below) keyed on
 * published-article count — a proxy already used elsewhere in this
 * codebase (RankingsTab) as the primary research-output signal — not a
 * user-editable label. A tenant only ever sees its own exact numbers plus
 * its peer band's aggregate/median; it never sees another tenant's raw,
 * identifiable figures, so this can't be used to reverse-engineer a
 * specific competitor's standing.
 */
import type { ExtendedTransactionClient } from "@/lib/db-rls";

export interface PeerBand {
  key: string;
  label: string;
  min: number;
  max: number | null;
}

// Fixed, documented thresholds on published-article count. Not dynamic
// quartiles — a tenant's band should not silently shift because other
// tenants signed up or churned; stability makes period-over-period
// comparison meaningful.
export const PEER_BANDS: readonly PeerBand[] = [
  { key: "emerging", label: "Emerging (0-9 published articles)", min: 0, max: 9 },
  { key: "growing", label: "Growing (10-49 published articles)", min: 10, max: 49 },
  { key: "established", label: "Established (50-199 published articles)", min: 50, max: 199 },
  { key: "leading", label: "Leading (200+ published articles)", min: 200, max: null },
];

export function bandForPublicationCount(count: number): PeerBand {
  return PEER_BANDS.find((b) => count >= b.min && (b.max === null || count <= b.max)) ?? PEER_BANDS[0];
}

export interface TenantResearchMetrics {
  tenantId: string;
  publications: number;
  citations: number;
  avgCitationsPerArticle: number;
  collaborativeArticles: number; // articles with 2+ listed authors
  researchAreas: number; // distinct Article.discipline values
  fundingTotal: number; // sum of Grant.amount (mixed-currency, see caveat in metric label)
  grantCount: number;
  patentCount: number;
  datasetCount: number; // DatasetLink rows — open-research signal
  internationalReach: number; // distinct non-null User.country values, tenant users
  activeResearchers: number; // distinct corresponding-author users on published articles
  researcherProductivity: number; // publications / activeResearchers, 0 if no researchers
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

/** Computes real metrics for every tenant, keyed by tenantId. Internal — callers should use computeTenantBenchmark, which never exposes other tenants' raw numbers. */
async function computeAllTenantMetrics(tx: ExtendedTransactionClient): Promise<Map<string, TenantResearchMetrics>> {
  const [tenants, articles, grants, patents, datasetLinks, users] = await Promise.all([
    tx.tenant.findMany({ select: { id: true } }),
    tx.article.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, citations: true, discipline: true, authors: true, correspondingAuthorId: true, journal: { select: { tenantId: true } } },
    }),
    tx.grant.findMany({ select: { tenantId: true, amount: true } }),
    tx.patent.findMany({ select: { tenantId: true } }),
    tx.datasetLink.findMany({ select: { article: { select: { journal: { select: { tenantId: true } } } } } }),
    tx.user.findMany({ select: { tenantId: true, country: true } }),
  ]);

  const byTenant = new Map<string, TenantResearchMetrics>();
  for (const t of tenants) {
    byTenant.set(t.id, {
      tenantId: t.id,
      publications: 0,
      citations: 0,
      avgCitationsPerArticle: 0,
      collaborativeArticles: 0,
      researchAreas: 0,
      fundingTotal: 0,
      grantCount: 0,
      patentCount: 0,
      datasetCount: 0,
      internationalReach: 0,
      activeResearchers: 0,
      researcherProductivity: 0,
    });
  }

  const disciplinesByTenant = new Map<string, Set<string>>();
  const researchersByTenant = new Map<string, Set<string>>();
  const citationsByTenant = new Map<string, number[]>();

  for (const a of articles) {
    const tenantId = a.journal?.tenantId;
    if (!tenantId) continue;
    const m = byTenant.get(tenantId);
    if (!m) continue;
    m.publications += 1;
    m.citations += a.citations;

    let authorCount = 0;
    try {
      const parsed = JSON.parse(a.authors);
      authorCount = Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      authorCount = 0;
    }
    if (authorCount >= 2) m.collaborativeArticles += 1;

    if (a.discipline) {
      const set = disciplinesByTenant.get(tenantId) ?? new Set<string>();
      set.add(a.discipline);
      disciplinesByTenant.set(tenantId, set);
    }
    if (a.correspondingAuthorId) {
      const set = researchersByTenant.get(tenantId) ?? new Set<string>();
      set.add(a.correspondingAuthorId);
      researchersByTenant.set(tenantId, set);
    }
    const arr = citationsByTenant.get(tenantId) ?? [];
    arr.push(a.citations);
    citationsByTenant.set(tenantId, arr);
  }

  for (const g of grants) {
    const m = byTenant.get(g.tenantId);
    if (!m) continue;
    m.grantCount += 1;
    m.fundingTotal += g.amount ?? 0;
  }

  for (const p of patents) {
    const m = byTenant.get(p.tenantId);
    if (!m) continue;
    m.patentCount += 1;
  }

  for (const d of datasetLinks) {
    const tenantId = d.article?.journal?.tenantId;
    if (!tenantId) continue;
    const m = byTenant.get(tenantId);
    if (!m) continue;
    m.datasetCount += 1;
  }

  const countriesByTenant = new Map<string, Set<string>>();
  for (const u of users) {
    if (!u.tenantId || !u.country) continue;
    const set = countriesByTenant.get(u.tenantId) ?? new Set<string>();
    set.add(u.country);
    countriesByTenant.set(u.tenantId, set);
  }

  for (const [tenantId, m] of byTenant) {
    m.researchAreas = disciplinesByTenant.get(tenantId)?.size ?? 0;
    m.activeResearchers = researchersByTenant.get(tenantId)?.size ?? 0;
    m.internationalReach = countriesByTenant.get(tenantId)?.size ?? 0;
    m.researcherProductivity = m.activeResearchers > 0 ? Math.round((m.publications / m.activeResearchers) * 100) / 100 : 0;
    m.avgCitationsPerArticle = average(citationsByTenant.get(tenantId) ?? []);
  }

  return byTenant;
}

export interface PeerAggregate {
  band: PeerBand;
  peerCount: number; // number of tenants in this band, including the requesting tenant
  medianCitations: number;
  medianFundingTotal: number;
  medianPatentCount: number;
  medianDatasetCount: number;
  medianInternationalReach: number;
  medianResearcherProductivity: number;
  avgCollaborativeArticleRatio: number; // collaborativeArticles / publications, averaged across the band
}

export interface TenantBenchmarkResult {
  own: TenantResearchMetrics;
  peers: PeerAggregate;
}

/**
 * Computes one tenant's real metrics plus its peer band's aggregate/
 * median — the only cross-tenant data ever returned. Call inside
 * withRlsContext (see /api/admin/benchmarking).
 */
export async function computeTenantBenchmark(tx: ExtendedTransactionClient, tenantId: string): Promise<TenantBenchmarkResult> {
  const all = await computeAllTenantMetrics(tx);
  const own = all.get(tenantId);
  if (!own) {
    throw new Error("Tenant not found");
  }

  const band = bandForPublicationCount(own.publications);
  const peerMetrics = [...all.values()].filter((m) => bandForPublicationCount(m.publications).key === band.key);

  const peers: PeerAggregate = {
    band,
    peerCount: peerMetrics.length,
    medianCitations: median(peerMetrics.map((m) => m.citations)),
    medianFundingTotal: median(peerMetrics.map((m) => m.fundingTotal)),
    medianPatentCount: median(peerMetrics.map((m) => m.patentCount)),
    medianDatasetCount: median(peerMetrics.map((m) => m.datasetCount)),
    medianInternationalReach: median(peerMetrics.map((m) => m.internationalReach)),
    medianResearcherProductivity: median(peerMetrics.map((m) => m.researcherProductivity)),
    avgCollaborativeArticleRatio: average(peerMetrics.map((m) => (m.publications > 0 ? m.collaborativeArticles / m.publications : 0))),
  };

  return { own, peers };
}
