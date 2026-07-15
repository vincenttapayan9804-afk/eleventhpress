/**
 * Altmetric and PlumX badges are free, public, unauthenticated embeds keyed
 * off a real DOI — no vendor account or API key is required for the badge
 * display tier (only Digital Science's bulk "Details Page API" is paid, and
 * this integration doesn't use it). Because they're genuinely live, third-
 * party services, a badge for an article whose DOI doesn't yet resolve (or
 * hasn't been indexed) will honestly show little or no attention data —
 * that's correct behavior, not a bug, and must never be papered over with a
 * fabricated count.
 */

export interface AttentionArticle {
  doi: string | null;
  doiStatus: string;
}

/** True only once the article has a DOI that's actually meant to resolve. */
export function attentionMetricsConfigured(article: AttentionArticle): boolean {
  return !!article.doi && article.doiStatus === "PUBLISHED";
}

export function altmetricBadgeProps(doi: string) {
  return {
    className: "altmetric-embed",
    "data-badge-type": "donut",
    "data-doi": doi,
    "data-hide-no-mentions": "true",
  } as const;
}

export function plumxBadgeProps(doi: string) {
  return {
    className: "plumx-plum-print-popup",
    "data-doi": doi,
    "data-popup": "left",
    "data-size": "medium",
  } as const;
}
