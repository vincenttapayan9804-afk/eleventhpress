import crypto from "crypto";
import { logoPngOf, publisherIdentityForTenantId } from "@/lib/publisher-identity";
import sharp from "sharp";
import type { Certificate } from "@prisma/client";
import { db } from "@/lib/db";
import { putObject } from "@/lib/storage";
import { buildRecognitionCertificate, buildMembershipCertificate, buildAffiliationCard, type CertificateBrand } from "@/lib/certificate-pdf";
import {
  BOARD_EDITOR_ROLES,
  canonicalCertificatePayload,
  CANONICAL_PUBLISHER_NAME,
  CURRENT_CERTIFICATE_TEMPLATE_VERSION,
  type CertificateCategory,
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
    EXPERT: role === "EXPERT",
  };
}

/**
 * Issuer prefix for a whitelabel tenant's certificate serials: the initials
 * of its name ("Ron Publishing" → "RP"), so its certificates never carry
 * the platform's "EP". Latin letters only (serials are printed and typed).
 */
export function serialPrefixFor(name: string | null | undefined): string {
  const words = (name ?? "")
    .normalize("NFD")
    .replace(/[^A-Za-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const initials = (words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? "").slice(0, 3)).toUpperCase().slice(0, 5);
  // Never "EP" for a tenant — that's the platform's own prefix.
  return initials.length >= 2 && initials !== "EP" ? initials : "CERT";
}

/** EP-REC-A1B2C3D4E5 style — short, unique, and legible when printed. */
export function generateSerialNumber(type: CertificateType, issuerPrefix = "EP"): string {
  const prefix = type === "RECOGNITION" ? "REC" : type === "MEMBERSHIP" ? "MEM" : "PAC";
  const random = crypto.randomBytes(5).toString("hex").toUpperCase();
  return `${issuerPrefix}-${prefix}-${random}`;
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

/**
 * Fetches the user's real avatar and normalizes it to a fixed-size PNG via
 * sharp — pdfkit's doc.image() only decodes JPEG/PNG, but avatar uploads
 * also accept WebP/GIF (src/app/api/storage/presign/route.ts), so every
 * format needs to funnel through one decoder anyway. Best-effort: a
 * missing avatar, an unresolvable relative URL (local-dev storage mode,
 * see src/lib/storage.ts), or any fetch/decode failure just means the
 * certificate renders without a photo — never a broken image, never a
 * blocked certificate generation.
 */
async function resolveAvatarPng(avatarUrl: string | null): Promise<Buffer | null> {
  if (!avatarUrl || !avatarUrl.startsWith("http")) return null;
  try {
    const res = await fetch(avatarUrl);
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    return await sharp(bytes).resize(256, 256, { fit: "cover" }).png().toBuffer();
  } catch (e) {
    console.error("[certificates] avatar fetch/convert failed", e);
    return null;
  }
}

/** A tenant's logo as a PNG for PDFKit (keeps transparency); null on any failure. */
/** The organisation's uploaded logo as PNG (any storage form), or null. */
async function resolveLogoPng(logoUrl: string | null): Promise<Buffer | null> {
  return logoPngOf(logoUrl);
}

/**
 * Renders a certificate's PDF from the platform's current template/data
 * and persists it — shared by every issuance path (self-service
 * POST /api/certificates, its GET auto-heal pass, and the Prestige
 * Application approval flow's automatic Seal-of-Quality issuance). When
 * `existing` is provided, updates that same row in place (same id/
 * serialNumber/issuedAt — the recognition itself isn't new, only its
 * rendering is corrected) instead of minting a duplicate.
 */
export async function renderAndPersistCertificate(
  userId: string,
  type: CertificateType,
  category: CertificateCategory,
  existing: Certificate | null
): Promise<Certificate> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { fullName: true, avatarUrl: true, tenant: true },
  });
  if (!user) throw new Error("User not found");

  // Whitelabel: a tenant member's certificates are issued by their
  // institution, in its colours and with its logo.
  const tenant = user.tenant && !user.tenant.isPlatform ? user.tenant : null;

  // Journal.name is the journal's own title (e.g. "...Journal of
  // Multidisciplinary Research"); Journal.publisher is the umbrella brand
  // ("Eleventh Press International Publishing") — certificates are issued
  // by the publisher, not the journal, so publisher is the correct field.
  const journal = tenant
    ? await db.journal.findFirst({ where: { tenantId: tenant.id }, select: { publisher: true, issn: true } })
    : await db.journal.findFirst({ select: { publisher: true, issn: true } });
  const workTitle = category === "AUTHOR" ? await latestPublishedWorkTitle(userId) : null;
  const avatarPng = await resolveAvatarPng(user.avatarUrl);
  // The platform's own uploaded logo (if it has one) replaces the default
  // "EP" monogram in its seal, so platform certificates carry its exact logo too.
  const platformLogo = tenant ? null : await resolveLogoPng((await publisherIdentityForTenantId(null)).logoUrl);
  const brand: CertificateBrand | null = tenant
    ? {
        name: tenant.siteName || tenant.name,
        tagline: tenant.tagline,
        primaryColor: tenant.primaryColor,
        logoPng: await resolveLogoPng(tenant.logoUrl),
      }
    : platformLogo
      ? { name: CANONICAL_PUBLISHER_NAME, tagline: null, primaryColor: null, logoPng: platformLogo }
      : null;

  const serialNumber =
    existing?.serialNumber ?? generateSerialNumber(type, tenant ? serialPrefixFor(tenant.siteName || tenant.name) : "EP");
  const payload = {
    serialNumber,
    type,
    category,
    recipientName: user.fullName,
    issuedAtIso: (existing?.issuedAt ?? new Date()).toISOString(),
    journalName: tenant ? tenant.siteName || tenant.name : journal?.publisher || CANONICAL_PUBLISHER_NAME,
    issn: journal?.issn ?? null,
    workTitle,
  };
  const contentHash = computeContentHash(payload);

  const pdfBuffer =
    type === "RECOGNITION" ? await buildRecognitionCertificate(payload, avatarPng, brand) :
    type === "MEMBERSHIP" ? await buildMembershipCertificate(payload, avatarPng, brand) :
    await buildAffiliationCard(payload, avatarPng, brand);

  const pdfKey = existing?.pdfKey ?? certificateStorageKey(userId, serialNumber, "pdf");
  await putObject(pdfKey, pdfBuffer, "application/pdf");

  const data = {
    recipientName: user.fullName,
    journalName: payload.journalName,
    issn: payload.issn,
    workTitle: payload.workTitle,
    contentHash,
    pdfKey,
    templateVersion: CURRENT_CERTIFICATE_TEMPLATE_VERSION,
  };
  const certificate = existing
    ? await db.certificate.update({ where: { id: existing.id }, data })
    : await db.certificate.create({
        data: { userId, type: type as string, category: category as string, serialNumber, issuedAt: new Date(payload.issuedAtIso), ...data },
      });

  await db.auditLog.create({
    data: {
      userId,
      action: existing ? "CERTIFICATE_REGENERATED" : "CERTIFICATE_ISSUED",
      entityType: "CERTIFICATE",
      entityId: certificate.id,
      metadata: JSON.stringify({ type, category, serialNumber }),
    },
  });

  return certificate;
}
