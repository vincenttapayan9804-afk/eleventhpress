/**
 * Per-institution controls for the AI Research Assistant ("Ask the
 * Corpus"), question quotas, the corpus scope a reader can narrow to, and
 * the usage log behind the editors' analytics.
 *
 * Every institution (tenant, including the platform itself) has one
 * optional ResearchAssistantSettings row; without one the defaults below
 * apply. The row is read on every question, so it is cached briefly.
 */
import { db } from "@/lib/db";

export interface AssistantSettings {
  enabled: boolean;
  disclaimer: string | null;
  retentionDays: number | null;
  starterQuestions: string[];
  signedInHourlyLimit: number;
  anonymousHourlyLimit: number;
  logQuestions: boolean;
  updatedAt: string | null;
}

/** Questions per hour for a signed-in reader (their own quota, wherever they are). */
export const DEFAULT_SIGNED_IN_HOURLY = 60;
/** Questions per hour per network address for readers who aren't signed in.
 * A campus network can put many readers behind one address, so this is
 * generous and each institution can raise it. */
export const DEFAULT_ANONYMOUS_HOURLY = 40;

export const SETTINGS_BOUNDS = {
  hourly: { min: 1, max: 2000 },
  retentionDays: { min: 7, max: 3650 },
  disclaimerChars: 600,
  starterQuestions: 8,
  starterQuestionChars: 200,
} as const;

export const DEFAULT_SETTINGS: AssistantSettings = {
  enabled: true,
  disclaimer: null,
  retentionDays: null,
  starterQuestions: [],
  signedInHourlyLimit: DEFAULT_SIGNED_IN_HOURLY,
  anonymousHourlyLimit: DEFAULT_ANONYMOUS_HOURLY,
  logQuestions: true,
  updatedAt: null,
};

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; value: AssistantSettings }>();

export function clearAssistantSettingsCache(tenantId?: string): void {
  if (tenantId) cache.delete(tenantId);
  else cache.clear();
}

function parseQuestions(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((q): q is string => typeof q === "string" && !!q.trim()).slice(0, SETTINGS_BOUNDS.starterQuestions) : [];
  } catch {
    return [];
  }
}

/** The settings for an institution (defaults when none are saved, or the database is unavailable). */
export async function getAssistantSettings(tenantId: string | null | undefined): Promise<AssistantSettings> {
  if (!tenantId) return DEFAULT_SETTINGS;
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  let value = DEFAULT_SETTINGS;
  try {
    const row = await db.researchAssistantSettings.findUnique({ where: { tenantId } });
    if (row) {
      value = {
        enabled: row.enabled,
        disclaimer: row.disclaimer?.trim() || null,
        retentionDays: row.retentionDays ?? null,
        starterQuestions: parseQuestions(row.starterQuestions),
        signedInHourlyLimit: row.signedInHourlyLimit ?? DEFAULT_SIGNED_IN_HOURLY,
        anonymousHourlyLimit: row.anonymousHourlyLimit ?? DEFAULT_ANONYMOUS_HOURLY,
        logQuestions: row.logQuestions,
        updatedAt: row.updatedAt.toISOString(),
      };
    }
  } catch {
    // Table missing or database unavailable: defaults.
  }
  cache.set(tenantId, { at: Date.now(), value });
  return value;
}

function clampInt(v: unknown, min: number, max: number): number | null | undefined {
  if (v === null || v === "") return null;
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Validates an admin's settings form into a database update. Unknown or
 * invalid fields are ignored; `null` resets a field to its default. */
export function sanitizeSettingsInput(body: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (typeof body.logQuestions === "boolean") data.logQuestions = body.logQuestions;
  if (body.disclaimer === null) data.disclaimer = null;
  else if (typeof body.disclaimer === "string") data.disclaimer = body.disclaimer.replace(/\s+/g, " ").trim().slice(0, SETTINGS_BOUNDS.disclaimerChars) || null;
  const retention = clampInt(body.retentionDays, SETTINGS_BOUNDS.retentionDays.min, SETTINGS_BOUNDS.retentionDays.max);
  if (retention !== undefined) data.retentionDays = retention;
  const signedIn = clampInt(body.signedInHourlyLimit, SETTINGS_BOUNDS.hourly.min, SETTINGS_BOUNDS.hourly.max);
  if (signedIn !== undefined) data.signedInHourlyLimit = signedIn;
  const anon = clampInt(body.anonymousHourlyLimit, SETTINGS_BOUNDS.hourly.min, SETTINGS_BOUNDS.hourly.max);
  if (anon !== undefined) data.anonymousHourlyLimit = anon;
  if (Array.isArray(body.starterQuestions)) {
    const qs = body.starterQuestions
      .filter((q): q is string => typeof q === "string")
      .map((q) => q.replace(/\s+/g, " ").trim().slice(0, SETTINGS_BOUNDS.starterQuestionChars))
      .filter(Boolean)
      .slice(0, SETTINGS_BOUNDS.starterQuestions);
    data.starterQuestions = qs.length ? JSON.stringify(qs) : null;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Scope: which part of the institution's corpus a question searches.
// ---------------------------------------------------------------------------

export interface CorpusScope {
  disciplines?: string[];
  yearFrom?: number;
  yearTo?: number;
  issueId?: string;
  articleIds?: string[];
}

const MAX_SCOPE_ARTICLES = 12;

/** Validates a scope sent by the browser. Returns null when nothing narrows the search. */
export function cleanScope(raw: unknown): CorpusScope | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const scope: CorpusScope = {};
  if (Array.isArray(r.disciplines)) {
    const d = r.disciplines.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim().slice(0, 120));
    if (d.length) scope.disciplines = [...new Set(d)].slice(0, 12);
  }
  const year = (v: unknown) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1900 && n <= 2200 ? n : undefined;
  };
  const from = year(r.yearFrom);
  const to = year(r.yearTo);
  if (from !== undefined) scope.yearFrom = from;
  if (to !== undefined) scope.yearTo = to;
  if (scope.yearFrom && scope.yearTo && scope.yearFrom > scope.yearTo) [scope.yearFrom, scope.yearTo] = [scope.yearTo, scope.yearFrom];
  if (typeof r.issueId === "string" && /^[\w-]{1,64}$/.test(r.issueId)) scope.issueId = r.issueId;
  if (Array.isArray(r.articleIds)) {
    const ids = r.articleIds.filter((x): x is string => typeof x === "string" && /^[\w-]{1,64}$/.test(x));
    if (ids.length) scope.articleIds = [...new Set(ids)].slice(0, MAX_SCOPE_ARTICLES);
  }
  return Object.keys(scope).length ? scope : null;
}

/**
 * The Prisma `where` for the published articles a question may draw on:
 * always the institution's own journals, narrowed by the reader's scope.
 * `tenantId` null (the tenant couldn't be resolved) applies no tenant filter.
 */
export function corpusArticleWhere(tenantId: string | null, scope: CorpusScope | null): Record<string, unknown> {
  const where: Record<string, unknown> = { status: "PUBLISHED" };
  if (tenantId) where.journal = { tenantId };
  if (!scope) return where;
  if (scope.disciplines?.length) where.discipline = { in: scope.disciplines };
  if (scope.yearFrom || scope.yearTo) {
    where.publishedAt = {
      ...(scope.yearFrom ? { gte: new Date(Date.UTC(scope.yearFrom, 0, 1)) } : {}),
      ...(scope.yearTo ? { lt: new Date(Date.UTC(scope.yearTo + 1, 0, 1)) } : {}),
    };
  }
  if (scope.issueId) where.issueId = scope.issueId;
  if (scope.articleIds?.length) where.id = { in: scope.articleIds };
  return where;
}

/** "Environmental Science · 2022–2024" — a short description of a scope for the prompt and the UI. */
export function describeScope(scope: CorpusScope | null, extra: { issueLabel?: string | null; articleTitles?: string[] } = {}): string {
  if (!scope) return "";
  const parts: string[] = [];
  if (scope.articleIds?.length) {
    parts.push(
      extra.articleTitles?.length
        ? extra.articleTitles.map((t) => `"${t}"`).join(", ")
        : `${scope.articleIds.length} selected article${scope.articleIds.length === 1 ? "" : "s"}`
    );
  }
  if (scope.disciplines?.length) parts.push(scope.disciplines.join(", "));
  if (scope.yearFrom || scope.yearTo) {
    parts.push(
      scope.yearFrom && scope.yearTo
        ? scope.yearFrom === scope.yearTo
          ? `published in ${scope.yearFrom}`
          : `published ${scope.yearFrom}–${scope.yearTo}`
        : scope.yearFrom
          ? `published from ${scope.yearFrom}`
          : `published up to ${scope.yearTo}`
    );
  }
  if (scope.issueId) parts.push(extra.issueLabel || "one issue");
  return parts.join("; ");
}

// ---------------------------------------------------------------------------
// Coverage: how much of the corpus an answer stands on.
// ---------------------------------------------------------------------------

export type Coverage = "strong" | "partial" | "limited" | "none";

/** A plain coverage grade from what the answer cited and what the evidence check found. */
export function coverageOf(input: { grounded: boolean; citedArticles: number; citations: number; evidenceStatus: string }): Coverage {
  if (!input.grounded || input.citations === 0) return "none";
  if (input.evidenceStatus === "unsupported") return "none";
  if (input.evidenceStatus === "review") return input.citations >= 2 ? "partial" : "limited";
  if (input.citations >= 3 || input.citedArticles >= 2) return "strong";
  return input.citations >= 2 ? "partial" : "limited";
}

// ---------------------------------------------------------------------------
// Usage log.
// ---------------------------------------------------------------------------

export function queryLogRetentionDays(): number {
  const n = Number(process.env.RESEARCH_LOG_RETENTION_DAYS);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 180;
}

export interface QueryLogEntry {
  tenantId: string | null;
  signedIn: boolean;
  outcome: "answered" | "not-covered" | "not-indexed" | "unavailable" | "stopped";
  intent?: string;
  evidenceStatus?: string;
  articles?: number;
  citations?: number;
  latencyMs: number;
  scoped: boolean;
  question: string;
  logQuestion: boolean;
}

/** Records one question for the analytics. Never throws and never delays the reader. */
export function logResearchQuery(e: QueryLogEntry): void {
  if (process.env.NODE_ENV === "test" && !process.env.POSTGRES_PRISMA_URL) return;
  void Promise.resolve()
    .then(() => db.researchQueryLog.create({
      data: {
        tenantId: e.tenantId,
        signedIn: e.signedIn,
        outcome: e.outcome,
        intent: e.intent ?? null,
        evidenceStatus: e.evidenceStatus ?? null,
        articles: e.articles ?? 0,
        citations: e.citations ?? 0,
        latencyMs: Math.max(0, Math.round(e.latencyMs)),
        scoped: e.scoped,
        question: e.logQuestion ? e.question.slice(0, 400) : null,
      },
    }))
    .catch(() => {});
}
