import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeContentHash } from "@/lib/certificates";

/**
 * GET /api/certificates/verify/[serialNumber]
 * Public, no auth — recomputes the certificate's content hash from the
 * fields actually stored on this row and confirms it matches contentHash.
 * Since nothing in this codebase ever updates a Certificate row after
 * creation, a mismatch here would mean the row itself was tampered with at
 * the database level, not just a downloaded copy — the printed-on-the-PDF
 * hash is what catches tampering with a downloaded/printed document,
 * this endpoint is what a verifier checks it against.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ serialNumber: string }> }
) {
  const { serialNumber } = await params;
  const certificate = await db.certificate.findUnique({ where: { serialNumber } });
  if (!certificate) {
    return NextResponse.json({ found: false }, { status: 404 });
  }

  const recomputedHash = computeContentHash({
    serialNumber: certificate.serialNumber,
    type: certificate.type as any,
    category: certificate.category as any,
    recipientName: certificate.recipientName,
    issuedAtIso: certificate.issuedAt.toISOString(),
    journalName: certificate.journalName,
    issn: certificate.issn,
  });

  return NextResponse.json({
    found: true,
    valid: recomputedHash === certificate.contentHash,
    serialNumber: certificate.serialNumber,
    type: certificate.type,
    category: certificate.category,
    recipientName: certificate.recipientName,
    issuedAt: certificate.issuedAt,
    contentHash: certificate.contentHash,
  });
}
