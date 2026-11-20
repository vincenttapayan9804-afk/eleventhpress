/**
 * Scholarly signals for the articles a Research Assistant answer cites:
 * correction and retraction notices, references that have since been
 * retracted, citation counts and community reviews.
 *
 * Everything comes from integrations the journal already runs:
 *   - corrections: the journal's own Correction notices
 *   - retracted references: the local Retraction Watch mirror
 *     (src/lib/retraction-watch.ts), matched against Reference.doi
 *   - citation counts: OpenAlex (src/lib/citation-metrics.ts), cached
 *   - community reviews: stored Hypothesis / PREreview / curated rows
 *     (src/lib/independent-reviews.ts), only for articles with a public
 *     Review History, as on the article page
 *
 * None of it is fed to the model. It is shown next to the sources so a
 * reader can weigh them. A lookup that fails is left out, never guessed.
 */
import { db } from "@/lib/db";
import { fetchWorkCitationMetrics } from "@/lib/citation-metrics";
import { INDEPENDENT_REVIEW_CHANNELS, type IndependentReviewChannel } from "@/lib/independent-reviews";

export type CorrectionType = "CORRIGENDUM" | "ERRATUM" | "EXPRESSION_OF_CONCERN" | "RETRACTION";

export interface SourceCorrection {
  type: CorrectionType | string;
  label: string;
  title: string;
  issuedAt: string;
  doi: string | null;
}

export interface SourceSignals {
  articleId: string;
  /** Newest first. */
  corrections: SourceCorrection[];
  /** "retracted" | "concern" | "corrected" | null — the most serious notice. */
  status: "retracted" | "concern" | "corrected" | null;
  /** null: the Retraction Watch mirror has never been synced, so nothing can be said. */
  retractedReferences: { doi: string; title: string | null; retractionDate: string | null }[] | null;
  /** null: no DOI, or OpenAlex has no record (yet). */
  citations: { count: number; url: string | null } | null;
  communityReviews: { count: number; items: { channel: string; url: string; reviewer: string | null; postedAt: string | null }[] };
}

const CORRECTION_LABELS: Record<string, string> = {
  RETRACTION: "Retraction",
  EXPRESSION_OF_CONCERN: "Expression of concern",
  CORRIGENDUM: "Corrigendum",
  ERRATUM: "Erratum",
};

export function correctionLabel(type: string): string {
  return CORRECTION_LABELS[type] ?? "Correction";
}

/** The most serious notice among an article's corrections. */
export function correctionStatus(types: string[]): SourceSignals["status"] {
  if (types.includes("RETRACTION")) return "retracted";
  if (types.includes("EXPRESSION_OF_CONCERN")) return "concern";
  return types.length > 0 ? "corrected" : null;
}

// ---------------------------------------------------------------------------
// Citation counts: cached per DOI for a day (per server instance), so an
// answer that cites the same papers again doesn't call OpenAlex again.
// ---------------------------------------------------------------------------

const CITATION_TTL_MS = 24 * 60 * 60 * 1000;
const CITATION_MISS_TTL_MS = 60 * 60 * 1000;
const CITATION_CACHE_MAX = 2000;
const citationCache = new Map<string, { at: number; value: { count: number; openAlexId: string | null } | null }>();

export function __resetSourceSignalCacheForTests() {
  citationCache.clear();
}

function normalizeDoi(doi: string): string {
  return doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim().toLowerCase();
}

async function citationCount(doi: string): Promise<{ count: number; openAlexId: string | null } | null> {
  const key = normalizeDoi(doi);
  const hit = citationCache.get(key);
  if (hit && Date.now() - hit.at < (hit.value === null ? CITATION_MISS_TTL_MS : CITATION_TTL_MS)) return hit.value;
  const metrics = await fetchWorkCitationMetrics(key).catch(() => null);
  const value = metrics ? { count: metrics.citedByCount, openAlexId: metrics.openAlexId } : null;
  if (citationCache.size >= CITATION_CACHE_MAX) {
    const oldest = citationCache.keys().next().value;
    if (oldest !== undefined) citationCache.delete(oldest);
  }
  citationCache.set(key, { at: Date.now(), value });
  return value;
}

/** References (by DOI) of the given articles that Retraction Watch lists as retracted. */
export async function findRetractedReferences(
  articleIds: string[]
): Promise<Map<string, { doi: string; title: string | null; retractionDate: string | null }[]> | null> {
  const meta = await db.retractionWatchSyncMeta.findUnique({ where: { id: "singleton" } });
  if (!meta?.lastSyncedAt) return null;
  const refs = await db.reference.findMany({
    where: { articleId: { in: articleIds }, doi: { not: null } },
    select: { articleId: true, doi: true },
  });
  const out = new Map<string, { doi: string; title: string | null; retractionDate: string | null }[]>(articleIds.map((id) => [id, []]));
  if (refs.length === 0) return out;
  const matches = await db.retractionWatchRecord.findMany({
    where: { originalPaperDoi: { in: [...new Set(refs.map((r) => r.doi!.toLowerCase()))] } },
    select: { originalPaperDoi: true, originalTitle: true, retractionDate: true },
  });
  const byDoi = new Map(matches.map((m) => [m.originalPaperDoi.toLowerCase(), m]));
  for (const r of refs) {
    const m = byDoi.get(r.doi!.toLowerCase());
    if (!m) continue;
    const list = out.get(r.articleId)!;
    if (list.some((x) => x.doi.toLowerCase() === r.doi!.toLowerCase())) continue;
    list.push({ doi: r.doi!, title: m.originalTitle, retractionDate: m.retractionDate ? m.retractionDate.toISOString().slice(0, 10) : null });
  }
  return out;
}

/** Correction notices for the given articles, newest first. */
export async function loadCorrections(articleIds: string[]): Promise<Map<string, SourceCorrection[]>> {
  const out = new Map<string, SourceCorrection[]>(articleIds.map((id) => [id, []]));
  if (articleIds.length === 0) return out;
  const rows = await db.correction.findMany({
    where: { articleId: { in: articleIds } },
    select: { articleId: true, type: true, title: true, doi: true, issuedAt: true },
    orderBy: { issuedAt: "desc" },
  });
  for (const r of rows) {
    out.get(r.articleId)?.push({ type: r.type, label: correctionLabel(r.type), title: r.title, issuedAt: r.issuedAt.toISOString().slice(0, 10), doi: r.doi });
  }
  return out;
}

/**
 * Plain-language warnings for an answer whose sources carry a retraction
 * or an expression of concern, for the answer's evidence check. Corrigenda
 * and errata are shown on the source but don't warn: they fix details.
 */
export function correctionWarnings(sources: { n: number; id: string }[], corrections: Map<string, SourceCorrection[]>): string[] {
  const warnings: string[] = [];
  for (const s of sources) {
    const status = correctionStatus((corrections.get(s.id) ?? []).map((c) => c.type));
    if (status === "retracted") warnings.push(`Source ${s.n} has been retracted by the journal. Don't rely on its findings.`);
    else if (status === "concern") warnings.push(`The journal has issued an expression of concern about source ${s.n}. Treat its findings with caution.`);
  }
  return warnings;
}

const MAX_REVIEWS_SHOWN = 3;

/** All signals for up to a handful of published articles, in one pass. */
export async function loadSourceSignals(
  articles: { id: string; doi: string | null; anonymizedReviewHistory?: boolean | null }[]
): Promise<SourceSignals[]> {
  const ids = articles.map((a) => a.id);
  if (ids.length === 0) return [];
  const reviewable = articles.filter((a) => a.anonymizedReviewHistory).map((a) => a.id);
  const [corrections, retracted, reviews, counts] = await Promise.all([
    loadCorrections(ids).catch(() => new Map<string, SourceCorrection[]>()),
    findRetractedReferences(ids).catch(() => null),
    reviewable.length
      ? db.independentReview
          .findMany({
            where: { articleId: { in: reviewable } },
            select: { articleId: true, channel: true, externalUrl: true, reviewerName: true, postedAt: true },
            orderBy: { postedAt: "desc" },
          })
          .catch(() => [])
      : Promise.resolve([]),
    Promise.all(articles.map((a) => (a.doi ? citationCount(a.doi) : Promise.resolve(null)))),
  ]);

  return articles.map((a, i) => {
    const notices = corrections.get(a.id) ?? [];
    const mine = reviews.filter((r) => r.articleId === a.id);
    const count = counts[i];
    return {
      articleId: a.id,
      corrections: notices,
      status: correctionStatus(notices.map((c) => c.type)),
      retractedReferences: retracted ? (retracted.get(a.id) ?? []) : null,
      citations: count
        ? {
            count: count.count,
            // The citing works on OpenAlex.
            url: count.openAlexId ? `https://openalex.org/works?filter=cites:${count.openAlexId}` : null,
          }
        : null,
      communityReviews: {
        count: mine.length,
        items: mine.slice(0, MAX_REVIEWS_SHOWN).map((r) => ({
          channel: INDEPENDENT_REVIEW_CHANNELS[r.channel as IndependentReviewChannel]?.label ?? r.channel,
          url: r.externalUrl,
          reviewer: r.reviewerName,
          postedAt: r.postedAt ? r.postedAt.toISOString().slice(0, 10) : null,
        })),
      },
    };
  });
}
