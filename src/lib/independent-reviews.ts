/**
 * Independent Review Network — free, external community/expert review
 * channels surfaced on the public Review History tab as a "Community and
 * Independent Review" section, alongside the journal's own in-house peer
 * review.
 *
 * Phase 3a wires up Hypothes.is: an open-source, actively maintained
 * annotation service (https://hypothes.is) with a real, public, unauthenticated
 * search API keyed on a plain URL — no DOI-matching ambiguity, and it works
 * for every article regardless of discipline. Later phases add PREreview
 * (DOI-keyed, real documented API) and editor-curated links for channels
 * with no stable public read API yet (PCI, Sciety, SciPost, OpenReview).
 *
 * Every row this writes is a REAL, fetched, verbatim excerpt from the named
 * external platform — never authored, paraphrased, or fabricated here. On
 * any fetch failure (including this platform's own sandbox network policy
 * blocking hypothes.is entirely during development), this fails open: the
 * error is recorded honestly in IndependentReviewSyncState.lastError, and
 * callers get back whatever was already stored (possibly nothing) rather
 * than a thrown exception.
 */
import { db } from "@/lib/db";

export const INDEPENDENT_REVIEW_CHANNELS = {
  HYPOTHESIS: {
    label: "Hypothes.is",
    homepage: "https://hypothes.is",
    description: "Open web annotations anchored to this article's page.",
  },
} as const;

export type IndependentReviewChannel = keyof typeof INDEPENDENT_REVIEW_CHANNELS;

const HYPOTHESIS_SEARCH_API = "https://hypothes.is/api/search";
const FETCH_TIMEOUT_MS = 4000;
const STALE_AFTER_MS = 6 * 60 * 60 * 1000; // 6 hours
const EXCERPT_MAX_LENGTH = 2000;

interface HypothesisAnnotationRow {
  id: string;
  uri: string;
  text?: string;
  created?: string;
  user?: string; // "acct:username@hypothes.is"
  links?: { html?: string; incontext?: string };
}

interface HypothesisSearchResponse {
  total?: number;
  rows?: HypothesisAnnotationRow[];
}

function formatHypothesisUser(acct: string | undefined): string | null {
  if (!acct) return null;
  const match = acct.match(/^acct:([^@]+)@/);
  return match ? match[1] : null;
}

export interface FetchedIndependentReview {
  externalId: string;
  externalUrl: string;
  reviewerName: string | null;
  excerpt: string | null;
  postedAt: Date | null;
}

/**
 * Queries Hypothes.is's real public search API for annotations anchored to
 * `canonicalUrl`. Throws on any network/HTTP failure — callers (the sync
 * function below) are responsible for catching and failing open.
 */
export async function fetchHypothesisAnnotations(canonicalUrl: string): Promise<FetchedIndependentReview[]> {
  const url = `${HYPOTHESIS_SEARCH_API}?uri=${encodeURIComponent(canonicalUrl)}&limit=50`;
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Hypothes.is search failed: HTTP ${res.status}`);
  const data = (await res.json()) as HypothesisSearchResponse;
  const rows = data.rows || [];

  return rows.map((row) => ({
    externalId: row.id,
    externalUrl: row.links?.incontext || row.links?.html || `https://hypothes.is/a/${row.id}`,
    reviewerName: formatHypothesisUser(row.user),
    excerpt: row.text ? row.text.slice(0, EXCERPT_MAX_LENGTH) : null,
    postedAt: row.created ? new Date(row.created) : null,
  }));
}

export interface IndependentReviewSyncResult {
  success: boolean;
  synced: number;
  error: string | null;
}

/**
 * Syncs one channel's reviews for one article, upserting by
 * (articleId, channel, externalId) so re-syncing never duplicates rows.
 * Always records a sync attempt in IndependentReviewSyncState — success or
 * failure — so getIndependentReviewsForArticle knows whether "nothing
 * found" means "genuinely checked, found nothing" or "never checked yet".
 */
export async function syncIndependentReviewsForArticle(
  articleId: string,
  canonicalUrl: string,
  channel: IndependentReviewChannel = "HYPOTHESIS"
): Promise<IndependentReviewSyncResult> {
  try {
    const fetched =
      channel === "HYPOTHESIS" ? await fetchHypothesisAnnotations(canonicalUrl) : [];

    for (const review of fetched) {
      await db.independentReview.upsert({
        where: {
          articleId_channel_externalId: { articleId, channel, externalId: review.externalId },
        },
        create: {
          articleId,
          channel,
          sourceType: "AUTOMATED",
          externalId: review.externalId,
          externalUrl: review.externalUrl,
          reviewerName: review.reviewerName,
          excerpt: review.excerpt,
          postedAt: review.postedAt,
        },
        update: {
          externalUrl: review.externalUrl,
          reviewerName: review.reviewerName,
          excerpt: review.excerpt,
          postedAt: review.postedAt,
          fetchedAt: new Date(),
        },
      });
    }

    await db.independentReviewSyncState.upsert({
      where: { articleId_channel: { articleId, channel } },
      create: { articleId, channel, lastCheckedAt: new Date(), lastError: null },
      update: { lastCheckedAt: new Date(), lastError: null },
    });

    return { success: true, synced: fetched.length, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.independentReviewSyncState
      .upsert({
        where: { articleId_channel: { articleId, channel } },
        create: { articleId, channel, lastCheckedAt: new Date(), lastError: message },
        update: { lastCheckedAt: new Date(), lastError: message },
      })
      .catch(() => {
        // Best-effort bookkeeping only — never let a failure here mask the
        // original sync error being returned below.
      });
    return { success: false, synced: 0, error: message };
  }
}

export interface IndependentReviewOut {
  id: string;
  channel: string;
  channelLabel: string;
  sourceType: string;
  externalUrl: string;
  reviewerName: string | null;
  excerpt: string | null;
  recommendation: string | null;
  postedAt: Date | null;
}

/**
 * Reader-facing read path for the Review History tab's "Community and
 * Independent Review" section. Re-syncs Hypothes.is in the background of
 * this call only when the last check for this article is missing or older
 * than the staleness window, so a popular article isn't re-fetched from an
 * external API on every single page view. Always returns whatever is
 * currently stored, synced or not — this never throws.
 */
export async function getIndependentReviewsForArticle(
  articleId: string,
  canonicalUrl: string
): Promise<IndependentReviewOut[]> {
  const state = await db.independentReviewSyncState.findUnique({
    where: { articleId_channel: { articleId, channel: "HYPOTHESIS" } },
  });
  const isStale = !state || Date.now() - state.lastCheckedAt.getTime() > STALE_AFTER_MS;
  if (isStale) {
    await syncIndependentReviewsForArticle(articleId, canonicalUrl, "HYPOTHESIS");
  }

  const rows = await db.independentReview.findMany({
    where: { articleId },
    orderBy: { postedAt: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    channel: r.channel,
    channelLabel:
      INDEPENDENT_REVIEW_CHANNELS[r.channel as IndependentReviewChannel]?.label || r.channel,
    sourceType: r.sourceType,
    externalUrl: r.externalUrl,
    reviewerName: r.reviewerName,
    excerpt: r.excerpt,
    recommendation: r.recommendation,
    postedAt: r.postedAt,
  }));
}
