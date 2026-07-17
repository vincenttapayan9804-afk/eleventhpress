import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { putObject, presignGet } from "@/lib/storage";
import {
  CERTIFICATE_TYPES,
  CERTIFICATE_CATEGORIES,
  computeEligibility,
  generateSerialNumber,
  computeContentHash,
  certificateStorageKey,
  type CertificateType,
  type CertificateCategory,
} from "@/lib/certificates";
import { buildRecognitionCertificate, buildMembershipCertificate, buildAffiliationCard } from "@/lib/certificate-pdf";

/**
 * GET /api/certificates
 * Returns the signed-in user's own issued certificates plus which
 * (type, category) combinations they're currently eligible to generate.
 * Eligibility is derived live from real data (published articles,
 * User.role) every request — never a separately hand-maintained flag.
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
      select: { id: true, type: true, category: true, serialNumber: true, issuedAt: true },
    }),
  ]);

  return NextResponse.json({ eligibility, certificates });
}

/**
 * POST /api/certificates
 * Body: { type: "RECOGNITION"|"MEMBERSHIP"|"AFFILIATION", category: "AUTHOR"|"REVIEWER"|"EDITOR" }
 * Eligibility is re-checked server-side (never trusts the client) against
 * the same live query GET uses. Idempotent per (user, type, category) — a
 * repeat request returns the certificate already on file rather than
 * minting a duplicate.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { type?: string; category?: string };
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
  if (existing) {
    return NextResponse.json({ certificate: existing, alreadyExisted: true });
  }

  const user = await db.user.findUnique({ where: { id: session.userId }, select: { fullName: true } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const journal = await db.journal.findFirst({ select: { name: true, issn: true } });

  const serialNumber = generateSerialNumber(type);
  const payload = {
    serialNumber,
    type,
    category,
    recipientName: user.fullName,
    issuedAtIso: new Date().toISOString(),
    journalName: journal?.name || "Eleventh Press International Publishing",
    issn: journal?.issn ?? null,
  };
  const contentHash = computeContentHash(payload);

  const pdfBuffer =
    type === "RECOGNITION" ? await buildRecognitionCertificate(payload) :
    type === "MEMBERSHIP" ? await buildMembershipCertificate(payload) :
    await buildAffiliationCard(payload);

  const pdfKey = certificateStorageKey(session.userId, serialNumber, "pdf");
  await putObject(pdfKey, pdfBuffer, "application/pdf");

  const certificate = await db.certificate.create({
    data: {
      userId: session.userId,
      type,
      category,
      recipientName: user.fullName,
      journalName: payload.journalName,
      issn: payload.issn,
      serialNumber,
      contentHash,
      pdfKey,
      issuedAt: new Date(payload.issuedAtIso),
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "CERTIFICATE_ISSUED",
      entityType: "CERTIFICATE",
      entityId: certificate.id,
      metadata: JSON.stringify({ type, category, serialNumber }),
    },
  });

  const url = await presignGet(pdfKey, `${serialNumber}.pdf`);
  return NextResponse.json({ certificate, url, alreadyExisted: false });
}
