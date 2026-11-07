import { NextRequest, NextResponse } from "next/server";
import { loadCertificateRecord } from "@/lib/certificate-verification-record";
import { buildCertificateVerificationPdf, certificateVerificationFileName } from "@/lib/certificate-verification-pdf";
import { extractRequestIp } from "@/lib/institutions";
import { checkRateLimit } from "@/lib/ratelimit";

/**
 * GET /api/certificates/verify/[serialNumber]/report — public, no auth. The
 * "Certificate Verification Report" PDF: the same live check /verify/[serial]
 * performs, typeset like the article provenance certificate. Never cached.
 * `?inline=1` opens it in the browser instead of downloading.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ serialNumber: string }> }) {
  const rl = await checkRateLimit(`certificate-report:${extractRequestIp(req.headers)}`, 20, 600);
  if (!rl.ok) return NextResponse.json({ error: rl.message }, { status: 429 });
  const { serialNumber } = await params;
  const lookup = await loadCertificateRecord(serialNumber);
  if (lookup.kind === "not-found") return NextResponse.json({ error: "No certificate with this serial number" }, { status: 404 });

  const pdf = await buildCertificateVerificationPdf(lookup.record);
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${certificateVerificationFileName(lookup.record)}"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "no-store",
      "X-Certificate-Verdict": lookup.record.verdict,
    },
  });
}
