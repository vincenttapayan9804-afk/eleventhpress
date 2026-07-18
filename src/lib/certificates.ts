import { PRIVILEGED_ROLES_LIST } from "@/lib/roles";

/**
 * Certificate constants, labels, and pure payload shaping — deliberately
 * kept free of both `db` and Node's `crypto` module so this file is safe
 * to import from Client Components (src/components/dashboard/
 * certificates-tab.tsx does, for the type/category labels). Everything
 * that needs the database or crypto lives in certificates-server.ts
 * instead: a bug once let this file's db-dependent half get bundled into
 * client-side JS (any import from a module pulls in that module's own
 * top-level imports too, `db` included), which then unconditionally
 * threw in the browser the moment that chunk evaluated, since browsers
 * never receive server env vars like FIELD_ENCRYPTION_KEY. Keep this
 * split — don't reintroduce a `db` or `crypto` import here.
 */

/**
 * The canonical publisher brand name — the fallback when Journal.publisher
 * is unset. (Previously doubled as the sole auto-heal marker; that role now
 * belongs to CURRENT_CERTIFICATE_TEMPLATE_VERSION below, since a template
 * change like a new badge layout doesn't always come with a journalName
 * change to key off of.)
 */
export const CANONICAL_PUBLISHER_NAME = "Eleventh Press International Publishing";

/**
 * Bump this whenever src/lib/certificate-pdf.ts's visual template changes
 * in a way existing certificate holders should get automatically — a new
 * badge group, a border redesign, a layout fix. GET /api/certificates
 * auto-heals (re-renders in place) any stored certificate whose
 * templateVersion is behind this number, with zero action required from
 * whoever already generated one under the older template. Certificate.
 * templateVersion defaults to 0 in the schema, so every pre-existing row
 * heals automatically the first time this constant is bumped past 0.
 */
export const CURRENT_CERTIFICATE_TEMPLATE_VERSION = 3;

export const CERTIFICATE_TYPES = ["RECOGNITION", "MEMBERSHIP", "AFFILIATION"] as const;
export type CertificateType = (typeof CERTIFICATE_TYPES)[number];

export const CERTIFICATE_TYPE_LABELS: Record<CertificateType, string> = {
  RECOGNITION: "Certificate of Recognition",
  MEMBERSHIP: "Certificate of Membership",
  AFFILIATION: "Professional Affiliation Card",
};

export const CERTIFICATE_CATEGORIES = ["AUTHOR", "REVIEWER", "EDITOR"] as const;
export type CertificateCategory = (typeof CERTIFICATE_CATEGORIES)[number];

export const CERTIFICATE_CATEGORY_LABELS: Record<CertificateCategory, string> = {
  AUTHOR: "Published Author",
  REVIEWER: "Board of Reviewers Member",
  EDITOR: "Board of Editors Member",
};

// Same editorial-board bundle already used by GET /api/editorial-board —
// SUPER_ADMIN is treated as editorial staff there too, reused here for
// consistency rather than inventing a second definition of "editor."
export const BOARD_EDITOR_ROLES = PRIVILEGED_ROLES_LIST;

export interface CertificateEligibility {
  AUTHOR: boolean;
  REVIEWER: boolean;
  EDITOR: boolean;
}

export interface CertificatePayload {
  serialNumber: string;
  type: CertificateType;
  category: CertificateCategory;
  recipientName: string;
  issuedAtIso: string;
  journalName: string;
  issn: string | null;
  workTitle: string | null;
}

/**
 * Canonical, stable-key-order JSON — the exact bytes hashed at issuance and
 * the exact bytes re-derived on the public verify page. Any later edit to a
 * downloaded/printed certificate (name, date, category) breaks this match,
 * which is the actual tamper-evidence mechanism; the OpenTimestamps anchor
 * (src/lib/blockchain-timestamp.ts) additionally proves this hash existed
 * at or before the Bitcoin block it's confirmed in, independent of trusting
 * this platform's own database.
 */
export function canonicalCertificatePayload(p: CertificatePayload): string {
  return JSON.stringify({
    category: p.category,
    issn: p.issn,
    issuedAt: p.issuedAtIso,
    journal: p.journalName,
    recipient: p.recipientName,
    serial: p.serialNumber,
    type: p.type,
    workTitle: p.workTitle,
  });
}
