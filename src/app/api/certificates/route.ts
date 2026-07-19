import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { presignGet } from "@/lib/storage";
import {
  CERTIFICATE_TYPES,
  CERTIFICATE_CATEGORIES,
  CANONICAL_PUBLISHER_NAME,
  CURRENT_CERTIFICATE_TEMPLATE_VERSION,
  type CertificateType,
  type CertificateCategory,
} from "@/lib/certificates";
import { computeEligibility, renderAndPersistCertificate } from "@/lib/certificates-server";

/**
 * GET /api/certificates
 * Returns the signed-in user's own issued certificates plus which
 * (type, category) combinations they're currently eligible to generate.
 * Eligibility is derived live from real data (published articles,
 * User.role) every request — never a separately hand-maintained flag.
 *
 * Auto-heal: any certificate carrying the pre-fix journal name (see
 * CANONICAL_PUBLISHER_NAME) or a templateVersion behind
 * CURRENT_CERTIFICATE_TEMPLATE_VERSION was rendered under an older
 * template — overlapping text, wrong journal name, missing badges, an
 * outdated border — and is regenerated here automatically, with no
 * action required from whoever generated it before the fix shipped.
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
      if (c.journalName === CANONICAL_PUBLISHER_NAME && c.templateVersion >= CURRENT_CERTIFICATE_TEMPLATE_VERSION) return c;
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
