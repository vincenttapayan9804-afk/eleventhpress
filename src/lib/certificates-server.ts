import crypto from "crypto";
import { db } from "@/lib/db";
import {
  BOARD_EDITOR_ROLES,
  canonicalCertificatePayload,
  type CertificateEligibility,
  type CertificatePayload,
  type CertificateType,
} from "@/lib/certificates";

/**
 * Everything about certificate issuance that needs the database or Node's
 * `crypto` module — split out of certificates.ts so that file stays safe
 * to import from Client Components. Server-only: API routes and Server
 * Components (src/app/verify/[serialNumber]/page.tsx) import from here.
 */

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
