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

/**
 * Names and job titles typed in capitals ("VINCENT MARFE TAPAYAN",
 * "PROFESSIONAL NEUROPLASTICIAN") read as shouting on a profile, so they are
 * shown in title case. Anything already in mixed case is the author's own
 * styling and is left exactly as typed, and so is a single short capitalised
 * word, which is usually an acronym ("STCAST", "MIT").
 */
const LOWER_PARTICLES = new Set(["de", "del", "dela", "della", "der", "den", "da", "di", "do", "dos", "du", "la", "le", "van", "von", "y", "of", "and", "the", "in", "at", "for"]);

export function displayCase(value: string | null | undefined): string {
  const s = (value || "").trim();
  if (!s) return "";
  const letters = s.replace(/[^\p{L}]/gu, "");
  if (!letters || letters !== letters.toUpperCase()) return s;
  const words = s.split(/\s+/);
  if (words.length === 1 && letters.length <= 6) return s;
  return words
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (i > 0 && LOWER_PARTICLES.has(lower)) return lower;
      // Roman numerals and initials stay capitalised (III, J.R.).
      if (/^(i{1,3}|iv|vi{0,3}|ix|x)$/i.test(w) && i > 0) return w.toUpperCase();
      return lower.replace(/(^|[-'’.])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase()).replace(/^Mc(\p{L})/u, (_m, ch: string) => "Mc" + ch.toUpperCase());
    })
    .join(" ");
}
