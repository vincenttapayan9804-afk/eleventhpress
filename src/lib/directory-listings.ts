/**
 * Manual-application indexing directories — DOAJ (Directory of Open
 * Access Journals), ROAD, ISI (International Scientific Indexing),
 * ResearchBib, Citefactor, and SAJI Journal Index. Unlike Crossref/Zenodo
 * (real deposit APIs) or OAI-PMH/ReDIF (real crawler-pulled feeds), none
 * of these six expose any public submission API: a journal applies once
 * through each directory's own web form, a human reviewer evaluates it,
 * and only then does a listing appear. There is deliberately no
 * `<directory>LiveMode()` here like Zenodo/iThenticate have — there's no
 * live API to check. This module is pure status/label bookkeeping for the
 * self-reported, admin-maintained DirectoryListing table, mirroring
 * src/lib/preservation.ts's treatment of CLOCKSS/Portico.
 *
 * DOAJ is listed first — of these six, it's the highest-value one for a
 * genuine open-access journal (it's the field's de facto whitelist,
 * referenced directly by many institutional library discovery systems
 * and funder OA-compliance checkers, unlike the other five which are
 * lower-authority "also indexed in" directories).
 */

export const DIRECTORIES = ["DOAJ", "ROAD", "ISI", "RESEARCHBIB", "CITEFACTOR", "SAJI"] as const;
export type Directory = (typeof DIRECTORIES)[number];

export const DIRECTORY_LABELS: Record<Directory, string> = {
  DOAJ: "DOAJ (Directory of Open Access Journals)",
  ROAD: "ROAD (Directory of Open Access Scholarly Resources)",
  ISI: "International Scientific Indexing (ISI)",
  RESEARCHBIB: "ResearchBib",
  CITEFACTOR: "Citefactor",
  SAJI: "SAJI Journal Index",
};

export const DIRECTORY_APPLY_URLS: Record<Directory, string> = {
  DOAJ: "https://doaj.org/apply/",
  ROAD: "https://road.issn.org/",
  ISI: "https://isindexing.com/isi/",
  RESEARCHBIB: "https://www.researchbib.com/",
  CITEFACTOR: "https://www.citefactor.org/",
  SAJI: "https://www.scholarimpact.org/",
};

export const DIRECTORY_STATUSES = ["NOT_APPLIED", "APPLIED", "UNDER_REVIEW", "INDEXED", "REJECTED"] as const;
export type DirectoryStatus = (typeof DIRECTORY_STATUSES)[number];

export const DIRECTORY_STATUS_LABELS: Record<DirectoryStatus, string> = {
  NOT_APPLIED: "Not applied",
  APPLIED: "Applied",
  UNDER_REVIEW: "Under review",
  INDEXED: "Indexed",
  REJECTED: "Rejected",
};

/** Only an INDEXED listing is something the platform should ever publicly
 * claim — every earlier status is real progress but not yet a fact a
 * reader or librarian could verify by following a link. */
export function isIndexed(status: string): boolean {
  return status === "INDEXED";
}
