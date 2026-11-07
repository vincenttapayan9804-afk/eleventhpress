import { NextRequest, NextResponse } from "next/server";
import { loadCertificateRecord } from "@/lib/certificate-verification-record";

/**
 * GET /api/certificates/verify/[serialNumber]
 * Public, no auth — recomputes the certificate's content hash from the
 * fields actually stored on its row and confirms it matches contentHash
 * (src/lib/certificate-verification-record.ts). Nothing updates a
 * Certificate's certified fields after issuance except a re-render, which
 * recomputes the hash with them; a mismatch here would mean the row was
 * altered at the database level. The hash printed on the PDF is what
 * catches tampering with a downloaded/printed copy.
 */
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ serialNumber: string }> }) {
  const { serialNumber } = await params;
  const lookup = await loadCertificateRecord(serialNumber);
  if (lookup.kind === "not-found") {
    return NextResponse.json({ found: false }, { status: 404 });
  }
  const r = lookup.record;
  return NextResponse.json(
    {
      found: true,
      valid: r.verdict === "verified",
      verdict: r.verdict,
      checks: r.checks,
      checkedAt: r.checkedAt,
      serialNumber: r.serialNumber,
      type: r.type,
      typeLabel: r.typeLabel,
      category: r.category,
      categoryLabel: r.categoryLabel,
      recipientName: r.recipientName,
      issuer: r.issuer,
      issn: r.issn,
      issuedAt: r.issuedAt,
      contentHash: r.contentHash,
      recomputedHash: r.recomputedHash,
      workTitle: r.workTitle,
      verifyUrl: r.urls.verify,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
