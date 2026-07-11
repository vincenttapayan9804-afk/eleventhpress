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
