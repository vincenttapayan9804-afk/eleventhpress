import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { db } from "@/lib/db";
import type { Certificate } from "@prisma/client";
import { getSessionFromHeaders } from "@/lib/auth";
import { putObject, presignGet } from "@/lib/storage";
import {
  CERTIFICATE_TYPES,
  CERTIFICATE_CATEGORIES,
  CANONICAL_PUBLISHER_NAME,
  computeEligibility,
  generateSerialNumber,
  computeContentHash,
  certificateStorageKey,
  latestPublishedWorkTitle,
  type CertificateType,
  type CertificateCategory,
} from "@/lib/certificates";
import { buildRecognitionCertificate, buildMembershipCertificate, buildAffiliationCard } from "@/lib/certificate-pdf";

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

/**
 * Renders a certificate's PDF from the platform's current template/data
 * and persists it — shared by POST (new issuance or an explicit
 * `regenerate: true`) and GET's auto-heal pass below. When `existing` is
 * provided, updates that same row in place (same id/serialNumber/
 * issuedAt — the recognition itself isn't new, only its rendering is
 * corrected) instead of minting a duplicate.
 */
async function renderAndPersistCertificate(
  userId: string,
  type: CertificateType,
  category: CertificateCategory,
  existing: Certificate | null
): Promise<Certificate> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { fullName: true, avatarUrl: true } });
  if (!user) throw new Error("User not found");

  // Journal.name is the journal's own title (e.g. "...Journal of
  // Multidisciplinary Research"); Journal.publisher is the umbrella brand
  // ("Eleventh Press International Publishing") — certificates are issued
  // by the publisher, not the journal, so publisher is the correct field.
  const journal = await db.journal.findFirst({ select: { publisher: true, issn: true } });
  const workTitle = category === "AUTHOR" ? await latestPublishedWorkTitle(userId) : null;
  const avatarPng = await resolveAvatarPng(user.avatarUrl);

  const serialNumber = existing?.serialNumber ?? generateSerialNumber(type);
  const payload = {
    serialNumber,
    type,
    category,
    recipientName: user.fullName,
    issuedAtIso: (existing?.issuedAt ?? new Date()).toISOString(),
    journalName: journal?.publisher || CANONICAL_PUBLISHER_NAME,
    issn: journal?.issn ?? null,
    workTitle,
  };
  const contentHash = computeContentHash(payload);

  const pdfBuffer =
    type === "RECOGNITION" ? await buildRecognitionCertificate(payload, avatarPng) :
    type === "MEMBERSHIP" ? await buildMembershipCertificate(payload, avatarPng) :
    await buildAffiliationCard(payload, avatarPng);

  const pdfKey = existing?.pdfKey ?? certificateStorageKey(userId, serialNumber, "pdf");
  await putObject(pdfKey, pdfBuffer, "application/pdf");

  const data = {
    recipientName: user.fullName,
    journalName: payload.journalName,
    issn: payload.issn,
    workTitle: payload.workTitle,
    contentHash,
    pdfKey,
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

/**
 * GET /api/certificates
 * Returns the signed-in user's own issued certificates plus which
 * (type, category) combinations they're currently eligible to generate.
 * Eligibility is derived live from real data (published articles,
 * User.role) every request — never a separately hand-maintained flag.
 *
 * Auto-heal: any certificate still carrying the pre-fix journal name
 * (see CANONICAL_PUBLISHER_NAME) was rendered under the old, buggy
 * template — overlapping text, wrong journal name, no avatar/work title/
 * badges — and is regenerated here automatically, with no action required
 * from whoever generated it before the fix shipped.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const [eligibility, certificates] = await Promise.all([
    computeEligibility(session.userId, session.role),
    db.certificate.findMany({
      where: { userId: session.userId },
      orderBy: { issuedAt: "desc" },
    }),
  ]);

  const healed = await Promise.all(
    certificates.map(async (c) => {
      if (c.journalName === CANONICAL_PUBLISHER_NAME) return c;
      try {
        return await renderAndPersistCertificate(session.userId, c.type as CertificateType, c.category as CertificateCategory, c);
      } catch (e) {
        console.error("[certificates] auto-heal failed for", c.id, e);
        return c;
      }
    })
  );

  return NextResponse.json({
    eligibility,
    certificates: healed.map((c) => ({ id: c.id, type: c.type, category: c.category, serialNumber: c.serialNumber, issuedAt: c.issuedAt })),
  });
}

/**
 * POST /api/certificates
 * Body: { type, category, regenerate?: boolean }
 * Eligibility is re-checked server-side (never trusts the client) against
 * the same live query GET uses. Idempotent per (user, type, category) by
 * default — a repeat request returns the certificate already on file
 * rather than minting a duplicate. Pass `regenerate: true` to force a
 * re-render even when the stored certificate already looks current (GET's
 * auto-heal above already covers the common "was rendered before the fix"
 * case automatically).
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { type?: string; category?: string; regenerate?: boolean };
  const type = body.type as CertificateType;
  const category = body.category as CertificateCategory;
  if (!CERTIFICATE_TYPES.includes(type)) {
    return NextResponse.json({ error: `type must be one of ${CERTIFICATE_TYPES.join(", ")}` }, { status: 400 });
  }
  if (!CERTIFICATE_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: `category must be one of ${CERTIFICATE_CATEGORIES.join(", ")}` }, { status: 400 });
  }

  const eligibility = await computeEligibility(session.userId, session.role);
  if (!eligibility[category]) {
    return NextResponse.json({ error: `Not eligible for the ${category} capacity` }, { status: 403 });
  }

  const existing = await db.certificate.findFirst({
    where: { userId: session.userId, type, category },
  });
  if (existing && !body.regenerate) {
    return NextResponse.json({ certificate: existing, alreadyExisted: true });
  }

  const certificate = await renderAndPersistCertificate(session.userId, type, category, existing);
  const url = await presignGet(certificate.pdfKey, `${certificate.serialNumber}.pdf`);
  return NextResponse.json({ certificate, url, alreadyExisted: false, regenerated: !!existing });
}
