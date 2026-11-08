import { slugify } from "./spa-routes";

/**
 * Author profile URL (/authors/<slug>): the ORCID iD when there is one,
 * otherwise the slugified name. Client-safe (no database imports);
 * src/lib/author-profile.ts uses the same rule on the server.
 */
const ORCID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i;

export function authorSlug(a: { name: string; orcid?: string | null }): string {
  const orcid = (a.orcid || "").replace(/^https?:\/\/orcid\.org\//, "").trim();
  return ORCID_RE.test(orcid) ? orcid.toUpperCase() : slugify(a.name);
}

export function authorPath(a: { name: string; orcid?: string | null }): string {
  return `/authors/${encodeURIComponent(authorSlug(a))}`;
}
