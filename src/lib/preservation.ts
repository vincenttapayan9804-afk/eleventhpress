/**
 * Dark-archive preservation status tracking (CLOCKSS / Portico) — libraries
 * often require proof of this before signing an institutional license.
 * Neither service exposes a public per-article (or even per-journal)
 * submission API: CLOCKSS operates a distributed LOCKSS-technology network
 * that crawls a publisher's content under a published permission statement
 * or a signed agreement, and Portico's onboarding is a manual, contractual
 * process. There is deliberately no `<provider>LiveMode()` function here
 * like Zenodo/Blogger/iThenticate have — there's no live API to check.
 * This module is pure status/label bookkeeping for the self-reported,
 * admin-maintained record in the PreservationDeposit table, plus the one
 * genuinely automatable piece: the LOCKSS permission statement text CLOCKSS
 * (and LOCKSS-technology archives generally) look for to grant crawl
 * permission, which is real and useful today independent of whether a
 * formal agreement exists yet.
 */

export const PRESERVATION_PROVIDERS = ["CLOCKSS", "PORTICO"] as const;
export type PreservationProvider = (typeof PRESERVATION_PROVIDERS)[number];

export const PRESERVATION_STATUSES = [
  "NOT_STARTED",
  "AGREEMENT_PENDING",
  "HARVESTING_ENABLED",
  "CONFIRMED_ARCHIVED",
  "LAPSED",
] as const;
export type PreservationStatus = (typeof PRESERVATION_STATUSES)[number];

export const PRESERVATION_STATUS_LABELS: Record<PreservationStatus, string> = {
  NOT_STARTED: "Not started",
  AGREEMENT_PENDING: "Agreement pending",
  HARVESTING_ENABLED: "Harvesting enabled",
  CONFIRMED_ARCHIVED: "Confirmed archived",
  LAPSED: "Lapsed",
};

/** Only a CONFIRMED_ARCHIVED deposit is something the platform should ever
 * publicly claim — every earlier status is real progress but not yet a
 * fact a library reviewer could rely on. */
export function isConfirmedArchived(status: string): boolean {
  return status === "CONFIRMED_ARCHIVED";
}

export interface PreservationJournal {
  name: string;
  issn: string | null;
  publisher: string;
}

/**
 * The real, standard permission statement LOCKSS-technology crawlers
 * (CLOCKSS included) look for on a publisher's site to know they're
 * authorized to harvest and preserve its content — see
 * https://www.lockss.org/about/faq-permission-statement/. Publishing this
 * costs nothing and doesn't depend on having signed anything yet; it's the
 * actual mechanism, not a placeholder.
 */
export function lockssPermissionStatementText(journal: PreservationJournal): string {
  return `LOCKSS system has permission to collect, preserve, and serve this open access Archival Unit from ${journal.publisher}, on behalf of ${journal.name}${journal.issn ? ` (ISSN ${journal.issn})` : ""}.`;
}
