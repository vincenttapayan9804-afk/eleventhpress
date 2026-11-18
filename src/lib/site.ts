/**
 * Canonical public site origin — used everywhere a URL needs to actually
 * resolve for an external system (DOI landing pages, OAI-PMH identifiers,
 * Google Scholar citation tags, Crossref/OJS export hrefs, Crossmark domain
 * whitelist).
 *
 * Defaults to the site's own registered domain, eleventhpress.com (the
 * former eleventhpress.vercel.app host 308-redirects its pages here; see
 * redirects() in next.config.ts). eleventhpress.org is not a registered
 * domain — never use it in links. APP_BASE_URL (and
 * NEXT_PUBLIC_APP_BASE_URL for the client-side citation tags) still
 * override this default, e.g. for a self-hosted copy.
 */
export const APP_BASE_URL =
  process.env.APP_BASE_URL || "https://eleventhpress.com";

/** Bare hostname, for contexts that want just the host (OAI identifiers, Crossmark domain). */
export const APP_HOST = new URL(APP_BASE_URL).host;

/**
 * The DOI registrar actually in effect for newly published articles, for
 * every marketing/UI surface that names it (homepage trust badge, About
 * page, article checklist, FAQs, resources). This mirrors — but does not
 * drive — the real backend selection logic in the publish workflow
 * (src/app/api/articles/workflow/route.ts), which already prefers a real
 * Zenodo deposit whenever ZENODO_TOKEN is configured and only falls back to
 * the Crossref sandbox/simulation path otherwise (src/lib/zenodo.ts,
 * src/lib/crossref.ts). That backend selection is automatic and env-driven;
 * this constant is not, because it's inlined into the client bundle and a
 * secret-bearing env var can't safely gate copy there. Update this by hand
 * to "Crossref" once a real paid Crossref membership is live and
 * CROSSREF_USERNAME/PASSWORD are wired into the same always-deposit path
 * src/lib/zenodo.ts's Zenodo call currently owns — same manual-update
 * discipline as APP_BASE_URL above.
 */
export const DOI_REGISTRAR = "Zenodo";

/**
 * Declared language of every article's title/abstract/full text. Submission
 * only ever accepts English content today (no language picker exists at
 * submission, and none of the manuscript-processing pipeline branches on
 * language), so this is a fixed constant rather than a per-article field —
 * it exists so every place that already needed to assert a language value
 * (JATS `xml:lang`, EPUB `dc:language`, OAI-PMH `dc:language`, and the
 * `citation_language` meta tag Google Scholar/indexers look for) does so
 * from one place instead of five separately hardcoded "en" strings.
 */
export const ARTICLE_LANGUAGE = "en";

/**
 * This journal's "convening organization" address for the ORCID Peer
 * Review API (src/lib/orcid-peer-review.ts) — ORCID's schema requires a
 * city/country on every peer-review record pushed to a reviewer's
 * profile. Deliberately generic placeholders, same override-before-a-real-
 * registration discipline as DOI_REGISTRAR above: set JOURNAL_ORG_CITY /
 * JOURNAL_ORG_COUNTRY once a real registered office exists.
 */
export const JOURNAL_ORG_CITY = process.env.JOURNAL_ORG_CITY || "Remote";
export const JOURNAL_ORG_COUNTRY = process.env.JOURNAL_ORG_COUNTRY || "US";

/**
 * Journal identity block printed on every official document the platform
 * generates for readers (Resources guides, their PDF editions). Mirrors the
 * masthead on the About page (src/components/views/about-view.tsx) so the
 * two can't silently disagree; update both together.
 */
export const JOURNAL_IDENTITY = {
  name: "Eleventh Press International Publishing™",
  shortName: "Eleventh Press",
  tagline: "A Full-Stack Peer Reviewed Press & Multidisciplinary Syndication Network",
  /** Not yet assigned — the ISSN application is in progress. Set the real
   * number here once the National Library of the Philippines issues it. */
  issn: null as string | null,
  /** Not yet assigned — set once Crossref membership gives a prefix. */
  doiPrefix: null as string | null,
  location: "Philippines",
  editorialEmail: "editorial@eleventhpress.com",
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  apc: "USD 97",
} as const;

/** Shown wherever the platform's ISSN would appear until one is assigned. */
export const ISSN_PENDING_LABEL = "ISSN: applied for";

/** "ISSN 1234-5678", or the pending label when none is assigned yet. */
export function issnLabel(issn: string | null | undefined = JOURNAL_IDENTITY.issn): string {
  return issn ? `ISSN ${issn}` : ISSN_PENDING_LABEL;
}

/**
 * Prefix for internal placeholder DOIs (drafts, correction notices) until
 * the journal has its own Crossref prefix. 10.5072 is the reserved test
 * prefix, so these can never be mistaken for, or collide with, real DOIs.
 */
export const PLACEHOLDER_DOI_PREFIX = process.env.CROSSREF_DOI_PREFIX || "10.5072";

/**
 * When the Terms of Service and Privacy page were last materially changed.
 * Update it whenever their wording changes — never derive it from today's
 * date, which would claim the terms changed on every visit.
 */
export const LEGAL_PAGES_UPDATED = "November 18, 2026";
