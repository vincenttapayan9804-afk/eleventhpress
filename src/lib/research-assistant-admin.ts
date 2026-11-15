/**
 * The editors' view of the AI Research Assistant: who may see which
 * institution's feedback and analytics, and the analytics themselves.
 *
 * - A platform super admin (on the main site, in a platform account) sees
 *   the platform's own assistant by default, any institution with
 *   ?tenantId=<id>, or every institution together with ?tenantId=all.
 * - An institution's admin sees and configures only their institution.
 * - Editors see their institution's feedback and analytics, but don't
 *   change its settings.
 */
import { requireRole, type SessionPayload } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPlatformTenant, resolveTenantFromHeaders } from "@/lib/tenant";

export type AdminScope =
  | { ok: true; session: SessionPayload; tenantId: string | null; all: boolean; platformAdmin: boolean; platformTenantId: string | null; canManage: boolean }
  | { ok: false; status: 401 | 403; error: string };

const VIEW_ROLES = ["SUPER_ADMIN", "TENANT_ADMIN", "EDITOR"] as const;

export async function assistantAdminScope(headers: Headers, requested: string | null, opts: { manage?: boolean } = {}): Promise<AdminScope> {
  const auth = requireRole(headers, opts.manage ? ["SUPER_ADMIN", "TENANT_ADMIN"] : [...VIEW_ROLES]);
  if (!auth.ok) return auth;
  const session = auth.session;
  const [site, platform] = await Promise.all([
    resolveTenantFromHeaders(headers).catch(() => null),
    getPlatformTenant().catch(() => null),
  ]);
  const platformTenantId = platform?.id ?? null;
  const sessionTenant = session.tenantId ?? null;
  const ownIsPlatform = !sessionTenant || sessionTenant === platformTenantId;
  const onPlatformSite = !site || site.isPlatform;
  const platformAdmin = session.role === "SUPER_ADMIN" && ownIsPlatform && onPlatformSite;

  if (platformAdmin) {
    if (requested === "all") return { ok: true, session, tenantId: null, all: true, platformAdmin, platformTenantId, canManage: false };
    const tenantId = requested && /^[\w-]{1,64}$/.test(requested) ? requested : platformTenantId;
    return { ok: true, session, tenantId, all: false, platformAdmin, platformTenantId, canManage: true };
  }
  // Everyone else: their own institution only.
  const tenantId = sessionTenant ?? platformTenantId;
  if (!tenantId) return { ok: false, status: 403, error: "No institution to show" };
  if (site && !site.isPlatform && site.id !== tenantId) {
    return { ok: false, status: 403, error: "Forbidden — not an administrator of this institution" };
  }
  const canManage = session.role === "TENANT_ADMIN" || session.role === "SUPER_ADMIN";
  return { ok: true, session, tenantId, all: false, platformAdmin: false, platformTenantId, canManage };
}

/** Feedback/log rows of one institution. Rows saved before institutions were recorded belong to the platform. */
export function tenantRowFilter(scope: { tenantId: string | null; all: boolean; platformTenantId: string | null }): Record<string, unknown> {
  if (scope.all || !scope.tenantId) return {};
  if (scope.tenantId === scope.platformTenantId) return { OR: [{ tenantId: scope.tenantId }, { tenantId: null }] };
  return { tenantId: scope.tenantId };
}

export interface AssistantAnalytics {
  days: number;
  totals: {
    questions: number;
    answered: number;
    notCovered: number;
    unavailable: number;
    stopped: number;
    signedInShare: number | null;
    scopedShare: number | null;
    verifiedShare: number | null;
    medianLatencyMs: number | null;
    p90LatencyMs: number | null;
  };
  feedback: { helpful: number; notHelpful: number; issues: number; openIssues: number; helpfulRate: number | null };
  daily: { date: string; answered: number; notCovered: number; other: number }[];
  intents: { intent: string; count: number }[];
  unanswered: { question: string; count: number; last: string }[];
  byTenant?: { tenantId: string | null; name: string; questions: number; answered: number; helpfulRate: number | null; openIssues: number }[];
}

const MAX_LOG_ROWS = 20_000;

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[i];
}

function normalizeQuestion(q: string): string {
  return q.replace(/\s+/g, " ").trim().replace(/[?.!]+$/, "");
}

export async function assistantAnalytics(
  scope: { tenantId: string | null; all: boolean; platformTenantId: string | null },
  days: number
): Promise<AssistantAnalytics> {
  const since = new Date(Date.now() - days * 86_400_000);
  const filter = tenantRowFilter(scope);
  const [logs, feedback] = await Promise.all([
    db.researchQueryLog
      .findMany({
        where: { ...filter, createdAt: { gte: since } } as any,
        orderBy: { createdAt: "desc" },
        take: MAX_LOG_ROWS,
        select: { tenantId: true, outcome: true, intent: true, evidenceStatus: true, latencyMs: true, signedIn: true, scoped: true, question: true, createdAt: true },
      })
      .catch(() => [] as any[]),
    db.researchFeedback
      .findMany({
        where: { ...filter, createdAt: { gte: since } } as any,
        select: { tenantId: true, rating: true, status: true, question: true, createdAt: true },
        take: MAX_LOG_ROWS,
      })
      .catch(() => [] as any[]),
  ]);

  const count = (pred: (l: (typeof logs)[number]) => boolean) => logs.filter(pred).length;
  const answered = count((l) => l.outcome === "answered");
  const notCovered = count((l) => l.outcome === "not-covered" || l.outcome === "not-indexed");
  const unavailable = count((l) => l.outcome === "unavailable");
  const stopped = count((l) => l.outcome === "stopped");
  const finished = logs.filter((l) => l.outcome === "answered" || l.outcome === "not-covered");
  const latencies = finished.map((l) => l.latencyMs).sort((a, b) => a - b);
  const share = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

  const helpful = feedback.filter((f) => f.rating === "HELPFUL").length;
  const notHelpful = feedback.filter((f) => f.rating === "NOT_HELPFUL").length;
  const issues = feedback.filter((f) => f.rating === "ISSUE");

  // Daily series (UTC days, oldest first, every day present).
  const byDay = new Map<string, { answered: number; notCovered: number; other: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    byDay.set(d, { answered: 0, notCovered: 0, other: 0 });
  }
  for (const l of logs) {
    const d = new Date(l.createdAt).toISOString().slice(0, 10);
    const b = byDay.get(d);
    if (!b) continue;
    if (l.outcome === "answered") b.answered++;
    else if (l.outcome === "not-covered" || l.outcome === "not-indexed") b.notCovered++;
    else b.other++;
  }

  const intents = new Map<string, number>();
  for (const l of finished) intents.set(l.intent ?? "general", (intents.get(l.intent ?? "general") ?? 0) + 1);

  // Questions the journal couldn't answer, and those readers rated unhelpful.
  const gaps = new Map<string, { question: string; count: number; last: string }>();
  const addGap = (q: string | null, at: Date) => {
    if (!q) return;
    const key = normalizeQuestion(q).toLowerCase();
    if (!key) return;
    const g = gaps.get(key);
    const iso = new Date(at).toISOString();
    if (g) {
      g.count++;
      if (iso > g.last) g.last = iso;
    } else gaps.set(key, { question: normalizeQuestion(q), count: 1, last: iso });
  };
  for (const l of logs) if (l.outcome === "not-covered" || l.outcome === "not-indexed") addGap(l.question, l.createdAt);
  for (const f of feedback) if (f.rating === "NOT_HELPFUL") addGap(f.question, f.createdAt);

  const result: AssistantAnalytics = {
    days,
    totals: {
      questions: logs.length,
      answered,
      notCovered,
      unavailable,
      stopped,
      signedInShare: share(count((l) => l.signedIn), logs.length),
      scopedShare: share(count((l) => l.scoped), logs.length),
      verifiedShare: share(finished.filter((l) => l.evidenceStatus === "verified").length, finished.length),
      medianLatencyMs: percentile(latencies, 50),
      p90LatencyMs: percentile(latencies, 90),
    },
    feedback: {
      helpful,
      notHelpful,
      issues: issues.length,
      openIssues: issues.filter((f) => f.status !== "RESOLVED").length,
      helpfulRate: share(helpful, helpful + notHelpful),
    },
    daily: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
    intents: [...intents.entries()].map(([intent, c]) => ({ intent, count: c })).sort((a, b) => b.count - a.count),
    unanswered: [...gaps.values()].sort((a, b) => b.count - a.count || b.last.localeCompare(a.last)).slice(0, 15),
  };

  if (scope.all) {
    const tenants = await db.tenant.findMany({ select: { id: true, name: true, isPlatform: true } }).catch(() => [] as { id: string; name: string; isPlatform: boolean }[]);
    const keyOf = (id: string | null) => id ?? scope.platformTenantId;
    const rows = new Map<string | null, { questions: number; answered: number; helpful: number; notHelpful: number; openIssues: number }>();
    const row = (id: string | null) => {
      const k = keyOf(id);
      if (!rows.has(k)) rows.set(k, { questions: 0, answered: 0, helpful: 0, notHelpful: 0, openIssues: 0 });
      return rows.get(k)!;
    };
    for (const l of logs) {
      const r = row(l.tenantId);
      r.questions++;
      if (l.outcome === "answered") r.answered++;
    }
    for (const f of feedback) {
      const r = row(f.tenantId);
      if (f.rating === "HELPFUL") r.helpful++;
      if (f.rating === "NOT_HELPFUL") r.notHelpful++;
      if (f.rating === "ISSUE" && f.status !== "RESOLVED") r.openIssues++;
    }
    result.byTenant = [...rows.entries()]
      .map(([tenantId, r]) => ({
        tenantId,
        name: tenants.find((t) => t.id === tenantId)?.name ?? "Unknown institution",
        questions: r.questions,
        answered: r.answered,
        helpfulRate: share(r.helpful, r.helpful + r.notHelpful),
        openIssues: r.openIssues,
      }))
      .sort((a, b) => b.questions - a.questions);
  }
  return result;
}
