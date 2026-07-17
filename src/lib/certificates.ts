import crypto from "crypto";
import { db } from "@/lib/db";

/**
 * Certificate eligibility, canonical content hashing, and serial-number
 * generation for the dashboard Certificates tab. Three document types,
 * each issuable per "capacity" a user actually holds — capacity is derived
 * live from real data (published articles, User.role) rather than a
 * separately hand-maintained flag, the same "derive from the real RBAC
 * system, don't duplicate it" principle GET /api/editorial-board already
 * uses for board membership.
 */

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
export const BOARD_EDITOR_ROLES = ["SUPER_ADMIN", "EDITOR", "ASSOCIATE_EDITOR"];

export interface CertificateEligibility {
  AUTHOR: boolean;
  REVIEWER: boolean;
  EDITOR: boolean;
}

export async function computeEligibility(userId: string, role: string): Promise<CertificateEligibility> {
  const publishedCount = await db.article.count({
    where: { correspondingAuthorId: userId, status: "PUBLISHED" },
  });
  return {
    AUTHOR: publishedCount > 0,
    REVIEWER: role === "REVIEWER",
    EDITOR: BOARD_EDITOR_ROLES.includes(role),
  };
}

/** EP-REC-A1B2C3D4E5 style — short, unique, and legible when printed. */
export function generateSerialNumber(type: CertificateType): string {
  const prefix = type === "RECOGNITION" ? "REC" : type === "MEMBERSHIP" ? "MEM" : "PAC";
  const random = crypto.randomBytes(5).toString("hex").toUpperCase();
  return `EP-${prefix}-${random}`;
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

/**
 * The exact title of the most recently published work (article or book)
 * this user corresponds to — cited on AUTHOR-category certificates so
 * "in recognition of the publication of..." names the actual work instead
 * of a generic phrase. Checks both Article and Book (a user's first
 * published work might be either) and returns whichever is more recent.
 */
export async function latestPublishedWorkTitle(userId: string): Promise<string | null> {
  const [article, book] = await Promise.all([
    db.article.findFirst({
      where: { correspondingAuthorId: userId, status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      select: { title: true, publishedAt: true },
    }),
    db.book.findFirst({
      where: { correspondingAuthorId: userId, status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      select: { title: true, subtitle: true, publishedAt: true },
    }),
  ]);

  if (!article && !book) return null;
  if (article && (!book || !book.publishedAt || (article.publishedAt && article.publishedAt >= book.publishedAt))) {
    return article.title;
  }
  if (book) return book.subtitle ? `${book.title}: ${book.subtitle}` : book.title;
  return null;
}

export function computeContentHash(p: CertificatePayload): string {
  return crypto.createHash("sha256").update(canonicalCertificatePayload(p)).digest("hex");
}

export function certificateStorageKey(userId: string, serialNumber: string, ext: "pdf" | "ots"): string {
  return `certificates/${userId}/${serialNumber}.${ext}`;
}
