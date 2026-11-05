import { NextRequest, NextResponse } from "next/server";
import { loadProvenanceRecord } from "@/lib/article-provenance-record";
import { buildProvenanceCertificatePdf, provenanceCertificateFileName } from "@/lib/provenance-certificate-pdf";

/**
 * GET /api/articles/[id]/verify/certificate — public, no auth. The
 * downloadable "Certificate of Digital Provenance" PDF for a published work:
 * the same live verification /verify/article/[id] performs, rendered as a
 * professionally typeset, watermarked document. Never cached — the verdict
 * and the issue timestamp printed on it are computed for this request.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lookup = await loadProvenanceRecord(id);
  if (lookup.kind === "not-found") {
    return NextResponse.json({ error: "No published article with this ID" }, { status: 404 });
  }
  if (lookup.kind === "unsealed") {
    return NextResponse.json({ error: "This article has no provenance seal to certify" }, { status: 409 });
  }

  const pdf = await buildProvenanceCertificatePdf(lookup.record);
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const filename = provenanceCertificateFileName(lookup.record);
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "no-store",
      "X-Provenance-Verdict": lookup.record.verdict,
    },
  });
}
