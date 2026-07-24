/**
 * Independent Review Network — Open Reputable Reviewer Platforms surfaced
 * on the public Review History tab as a "Community and Independent Review"
 * section, alongside the journal's own in-house peer review. Every channel
 * here is chosen for its standing in the research community: an established
 * reviewer reputation system, editorial/integrity safeguards, and a
 * transparent, publicly auditable review database — the same qualities
 * that make in-house peer review trustworthy, applied to reviews this
 * journal doesn't itself produce.
 *
 * Phase 3a wired up Hypothes.is: an open-source, actively maintained
 * annotation service (https://hypothes.is) with a real, public,
 * unauthenticated search API keyed on a plain URL — no DOI-matching
 * ambiguity, and it works for every article regardless of discipline.
 *
 * Phase 3b adds PREreview: a nonprofit, actually open-source, DOI-keyed
 * preprint review platform (https://prereview.org). Its "rapid review"
 * question set (ynNovel, ynMethod, ynRecommend, etc.) is confirmed from
 * PREreview's own open-source rapid-prereview repository, so those field
 * names are trustworthy. The exact response *wrapper* shape (array vs.
 * `{ rapidReviews: [...] }`, and whether each item carries its own stable
 * id/timestamp) could not be confirmed from documentation alone — this
 * sandbox's egress policy blocks prereview.org, so it was never possible to
 * make a real request and see a real response here. Parsing below is
 * therefore deliberately defensive: it accepts a few plausible wrapper
 * shapes and falls back to an empty result (never a thrown error) on
 * anything else, same as every other honesty-preserving check in this
 * codebase. This should be re-verified against a real response the first
 * time this runs somewhere prereview.org is reachable.
 *
 * Phase 3c adds PCI, Sciety, SciPost, and OpenReview — four more Open
 * Reputable Reviewer Platforms, each with its own strong reviewer-reputation
 * and integrity model (PCI's discipline-specific recommending communities,
 * Sciety's curating review groups, SciPost's openly published refereeing
 * reports, OpenReview's transparent review threads). Their review records
 * live on per-community pages rather than a single bulk-queryable database,
 * so the highest-integrity way to surface them here is editor-verified: an
 * editor who has actually read the real review on the real platform pastes
 * its URL, giving these entries the same human accountability as the
 * platform's own reviewer reputation systems. These rows are
 * `sourceType: "EDITOR_ENTERED"`, never auto-synced, and are validated only
 * for a well-formed http(s) URL — the content itself is vouched for by the
 * editor entering it, not fetched or scraped by this codebase. ScienceOpen
 * was considered but dropped entirely (this phase and 3b): no source could
 * confirm its actual DOI-based document URL scheme, and guessing one — even
 * for an editor-verified link — would risk shipping a broken or wrong
 * outbound link.
 *
 * Every AUTOMATED row this writes is a REAL, fetched record from the named
 * external platform — never authored, paraphrased, or fabricated here. On
 * any fetch failure, this fails open: the error is recorded honestly in
 * IndependentReviewSyncState.lastError, and callers get back whatever was
 * already stored (possibly nothing) rather than a thrown exception.
 */
import { db } from "@/lib/db";

export const INDEPENDENT_REVIEW_CHANNELS = {
  HYPOTHESIS: {
    label: "Hypothes.is",
    homepage: "https://hypothes.is",
    description: "An established open-annotation standard with a public, permanent audit trail for every annotation.",
    editorCurated: false,
  },
  PREREVIEW: {
    label: "PREreview",
    homepage: "https://prereview.org",
    description: "A reputation-tracked reviewer database of structured, DOI-keyed rapid reviews with transparent methodology.",
    editorCurated: false,
  },
  PCI: {
    label: "Peer Community In (PCI)",
    homepage: "https://peercommunityin.org",
    description: "Discipline-specific recommending communities with named editorial boards and a published recommendation record.",
    editorCurated: true,
  },
  SCIETY: {
    label: "Sciety",
    homepage: "https://sciety.org",
    description: "Aggregated evaluations from established curating review groups with public, trackable reputational histories.",
    editorCurated: true,
  },
  SCIPOST: {
    label: "SciPost",
    homepage: "https://scipost.org",
    description: "Openly published, editorially vetted refereeing reports with full reviewer accountability.",
    editorCurated: true,
  },
  OPENREVIEW: {
    label: "OpenReview",
    homepage: "https://openreview.net",
    description: "Transparent, timestamped review threads trusted as the reviewer-integrity standard across computer-science venues.",
    editorCurated: true,
  },
} as const;

export type IndependentReviewChannel = keyof typeof INDEPENDENT_REVIEW_CHANNELS;

const AUTO_SYNC_CHANNELS = (Object.keys(INDEPENDENT_REVIEW_CHANNELS) as IndependentReviewChannel[]).filter(
  (c) => !INDEPENDENT_REVIEW_CHANNELS[c].editorCurated
);

export const EDITOR_CURATED_CHANNELS = (Object.keys(INDEPENDENT_REVIEW_CHANNELS) as IndependentReviewChannel[]).filter(
  (c) => INDEPENDENT_REVIEW_CHANNELS[c].editorCurated
);

const HYPOTHESIS_SEARCH_API = "https://hypothes.is/api/search";
const PREREVIEW_API_BASE = "https://prereview.org/api/v2";
const FETCH_TIMEOUT_MS = 4000;
const STALE_AFTER_MS = 6 * 60 * 60 * 1000; // 6 hours
const EXCERPT_MAX_LENGTH = 2000;

export interface FetchedIndependentReview {
  externalId: string;
  externalUrl: string;
  reviewerName: string | null;
  excerpt: string | null;
  recommendation: string | null;
  postedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Hypothes.is
// ---------------------------------------------------------------------------

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

/**
 * Queries Hypothes.is's real public search API for annotations anchored to
 * `canonicalUrl`. Throws on any network/HTTP failure — callers are
 * responsible for catching and failing open.
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
    recommendation: null,
    postedAt: row.created ? new Date(row.created) : null,
  }));
}

// ---------------------------------------------------------------------------
// PREreview
// ---------------------------------------------------------------------------

// Confirmed real field names from PREreview's own open-source rapid-prereview
// repository (github.com/PREreview/rapid-prereview): a rapid review is 12
// yes/no/unsure/N/A answers to a fixed question set.
const RAPID_REVIEW_QUESTIONS: Record<string, string> = {
  ynNovel: "Novel",
  ynFuture: "Future work suggested",
  ynReproducibility: "Methods reproducible",
  ynMethod: "Methods appropriate",
  ynCoherent: "Results coherent",
  ynLimitations: "Limitations discussed",
  ynEthics: "Ethical concerns",
  ynNewData: "New data presented",
  ynRecommend: "Recommended",
  ynPeerReview: "Warrants peer review",
  ynAvailableCode: "Code available",
  ynAvailableData: "Data available",
};

interface RapidReviewRow {
  id?: string;
  uuid?: string;
  _id?: string;
  created?: string;
  createdAt?: string;
  authorHandle?: string;
  [key: string]: unknown; // yn* fields above
}

function prereviewPreprintId(doi: string): string {
  return `doi-${doi.replace(/\//g, "-")}`;
}

function summarizeRapidReview(row: RapidReviewRow): string {
  const parts: string[] = [];
  for (const [field, label] of Object.entries(RAPID_REVIEW_QUESTIONS)) {
    const value = row[field];
    if (typeof value === "string" && value.length > 0) {
      parts.push(`${label}: ${value}`);
    }
  }
  return parts.join(" · ");
}

/**
 * Best-effort stable id for a rapid review row when PREreview's response
 * doesn't carry one of its own — derived deterministically from the row's
 * real fetched content (never fabricated), so re-syncing the same review
 * still upserts in place instead of duplicating.
 */
function rapidReviewFallbackId(doi: string, row: RapidReviewRow, index: number): string {
  const raw = JSON.stringify(row);
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return `${doi}-${index}-${Math.abs(hash)}`;
}

/**
 * Queries PREreview's real, documented v2 API for rapid reviews of the
 * preprint identified by `doi`. Throws on any network/HTTP failure —
 * callers are responsible for catching and failing open. See the module
 * docstring above for the honesty caveat on the exact response shape.
 */
export async function fetchPrereviewRapidReviews(doi: string): Promise<FetchedIndependentReview[]> {
  const url = `${PREREVIEW_API_BASE}/preprints/${encodeURIComponent(prereviewPreprintId(doi))}/rapid-reviews`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`PREreview rapid-reviews fetch failed: HTTP ${res.status}`);
  const data = await res.json();

  const rows: RapidReviewRow[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.rapidReviews)
      ? data.rapidReviews
      : Array.isArray(data?.data)
        ? data.data
        : [];

  return rows.map((row, index) => ({
    externalId: row.id || row.uuid || row._id || rapidReviewFallbackId(doi, row, index),
    externalUrl: `https://prereview.org/preprints/${prereviewPreprintId(doi)}`,
    reviewerName: typeof row.authorHandle === "string" ? row.authorHandle : null,
    excerpt: summarizeRapidReview(row) || null,
    recommendation: typeof row.ynRecommend === "string" ? row.ynRecommend : null,
    postedAt: row.created || row.createdAt ? new Date((row.created || row.createdAt) as string) : null,
  }));
}

// ---------------------------------------------------------------------------
// Shared sync / read path
// ---------------------------------------------------------------------------

export interface IndependentReviewSyncResult {
  success: boolean;
  synced: number;
  error: string | null;
}

async function fetchForChannel(
  channel: IndependentReviewChannel,
  keys: { canonicalUrl: string; doi: string | null }
): Promise<FetchedIndependentReview[]> {
  if (channel === "HYPOTHESIS") {
    return fetchHypothesisAnnotations(keys.canonicalUrl);
  }
  if (channel === "PREREVIEW") {
    if (!keys.doi) return [];
    return fetchPrereviewRapidReviews(keys.doi);
  }
  return [];
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
  keys: { canonicalUrl: string; doi: string | null },
  channel: IndependentReviewChannel
): Promise<IndependentReviewSyncResult> {
  try {
    const fetched = await fetchForChannel(channel, keys);

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
          recommendation: review.recommendation,
          postedAt: review.postedAt,
        },
        update: {
          externalUrl: review.externalUrl,
          reviewerName: review.reviewerName,
          excerpt: review.excerpt,
          recommendation: review.recommendation,
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
  channelDescription: string;
  sourceType: string;
  externalUrl: string;
  reviewerName: string | null;
  excerpt: string | null;
  recommendation: string | null;
  postedAt: Date | null;
}

/**
 * Reader-facing read path for the Review History tab's "Community and
 * Independent Review" section. Re-syncs each auto-sync channel in the
 * background of this call only when the last check for (article, channel)
 * is missing or older than the staleness window, so a popular article isn't
 * re-fetched from an external API on every single page view. PREreview is
 * skipped entirely when the article has no DOI yet. Editor-curated channels
 * (PCI, Sciety, SciPost, OpenReview) are never auto-synced — their rows are
 * written directly by addEditorCuratedReview and simply read back here
 * alongside the automated ones. Always returns whatever is currently
 * stored, synced or not — this never throws.
 */
export async function getIndependentReviewsForArticle(
  articleId: string,
  keys: { canonicalUrl: string; doi: string | null }
): Promise<IndependentReviewOut[]> {
  const channelsToCheck = keys.doi ? AUTO_SYNC_CHANNELS : (["HYPOTHESIS"] as IndependentReviewChannel[]);

  await Promise.all(
    channelsToCheck.map(async (channel) => {
      const state = await db.independentReviewSyncState.findUnique({
        where: { articleId_channel: { articleId, channel } },
      });
      const isStale = !state || Date.now() - state.lastCheckedAt.getTime() > STALE_AFTER_MS;
      if (isStale) {
        await syncIndependentReviewsForArticle(articleId, keys, channel);
      }
    })
  );

  const rows = await db.independentReview.findMany({
    where: { articleId },
    orderBy: { postedAt: "desc" },
  });

  return rows.map(toIndependentReviewOut);
}

function toIndependentReviewOut(r: {
  id: string;
  channel: string;
  sourceType: string;
  externalUrl: string;
  reviewerName: string | null;
  excerpt: string | null;
  recommendation: string | null;
  postedAt: Date | null;
}): IndependentReviewOut {
  const channelMeta = INDEPENDENT_REVIEW_CHANNELS[r.channel as IndependentReviewChannel];
  return {
    id: r.id,
    channel: r.channel,
    channelLabel: channelMeta?.label || r.channel,
    channelDescription: channelMeta?.description || "",
    sourceType: r.sourceType,
    externalUrl: r.externalUrl,
    reviewerName: r.reviewerName,
    excerpt: r.excerpt,
    recommendation: r.recommendation,
    postedAt: r.postedAt,
  };
}

/**
 * Admin-facing read path for the editorial dashboard's curated-links
 * manager. Unlike getIndependentReviewsForArticle, this never triggers an
 * external sync — it just reads whatever is already stored, so opening the
 * manager doesn't hit external APIs, and works regardless of the article's
 * publish/Review-History-enabled status.
 */
export async function listIndependentReviewsForAdmin(articleId: string): Promise<IndependentReviewOut[]> {
  const rows = await db.independentReview.findMany({
    where: { articleId },
    orderBy: [{ sourceType: "asc" }, { postedAt: "desc" }],
  });
  return rows.map(toIndependentReviewOut);
}

export interface EditorCuratedReviewInput {
  channel: IndependentReviewChannel;
  externalUrl: string;
  reviewerName?: string | null;
  excerpt?: string | null;
  recommendation?: string | null;
}

/**
 * Adds an editor-verified independent review link for an Open Reputable
 * Reviewer Platform whose review record is best confirmed by hand (PCI,
 * Sciety, SciPost, OpenReview). The editor has actually read the real
 * review at `externalUrl`; this only validates the channel and that the
 * URL is well-formed http(s) — it never fetches or fabricates the review
 * content itself.
 */
export async function addEditorCuratedReview(
  articleId: string,
  input: EditorCuratedReviewInput
): Promise<IndependentReviewOut> {
  if (!EDITOR_CURATED_CHANNELS.includes(input.channel)) {
    throw new Error(`${input.channel} is not an editor-curated channel`);
  }

  let parsed: URL;
  try {
    parsed = new URL(input.externalUrl);
  } catch {
    throw new Error("externalUrl must be a valid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("externalUrl must be an http or https URL");
  }

  const row = await db.independentReview.create({
    data: {
      articleId,
      channel: input.channel,
      sourceType: "EDITOR_ENTERED",
      externalId: null,
      externalUrl: input.externalUrl,
      reviewerName: input.reviewerName || null,
      excerpt: input.excerpt || null,
      recommendation: input.recommendation || null,
      postedAt: new Date(),
    },
  });

  return toIndependentReviewOut(row);
}

/**
 * Removes an editor-curated review link. Refuses to touch AUTOMATED rows
 * through this path (those are only ever replaced by re-syncing) and
 * refuses rows that don't belong to the given article.
 */
export async function deleteEditorCuratedReview(articleId: string, reviewId: string): Promise<void> {
  const row = await db.independentReview.findUnique({ where: { id: reviewId } });
  if (!row || row.articleId !== articleId) {
    throw new Error("Review not found for this article");
  }
  if (row.sourceType !== "EDITOR_ENTERED") {
    throw new Error("Only editor-entered reviews can be removed this way");
  }
  await db.independentReview.delete({ where: { id: reviewId } });
}
