/**
 * Canonical public site origin — used everywhere a URL needs to actually
 * resolve for an external system (DOI landing pages, OAI-PMH identifiers,
 * Google Scholar citation tags, Crossref/OJS export hrefs, Crossmark domain
 * whitelist).
 *
 * Defaults to the real, live deployment. eleventhpress.org is not a
 * registered domain — using it would DNS-fail for every crawler, harvester,
 * and DOI resolver that follows these links. Once a real custom domain is
 * purchased and pointed at this deployment, set APP_BASE_URL (and
 * NEXT_PUBLIC_APP_BASE_URL for the client-side citation tags) to override
 * this default.
 */
export const APP_BASE_URL =
  process.env.APP_BASE_URL || "https://eleventhpress.vercel.app";

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
