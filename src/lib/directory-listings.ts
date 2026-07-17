/**
 * Manual-application indexing directories — ROAD, ISI (International
 * Scientific Indexing), ResearchBib, Citefactor, and SAJI Journal Index.
 * Unlike Crossref/Zenodo (real deposit APIs) or OAI-PMH/ReDIF (real
 * crawler-pulled feeds), none of these five expose any public submission
 * API: a journal applies once through each directory's own web form, a
 * human reviewer evaluates it, and only then does a listing appear. There
 * is deliberately no `<directory>LiveMode()` here like Zenodo/iThenticate
 * have — there's no live API to check. This module is pure status/label
 * bookkeeping for the self-reported, admin-maintained DirectoryListing
 * table, mirroring src/lib/preservation.ts's treatment of CLOCKSS/Portico.
 */

export const DIRECTORIES = ["ROAD", "ISI", "RESEARCHBIB", "CITEFACTOR", "SAJI"] as const;
export type Directory = (typeof DIRECTORIES)[number];

export const DIRECTORY_LABELS: Record<Directory, string> = {
  ROAD: "ROAD (Directory of Open Access Scholarly Resources)",
  ISI: "International Scientific Indexing (ISI)",
  RESEARCHBIB: "ResearchBib",
  CITEFACTOR: "Citefactor",
  SAJI: "SAJI Journal Index",
};

export const DIRECTORY_APPLY_URLS: Record<Directory, string> = {
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
