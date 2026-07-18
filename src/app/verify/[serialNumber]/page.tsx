import type { Metadata } from "next";
import { db } from "@/lib/db";
import { CERTIFICATE_TYPE_LABELS, CERTIFICATE_CATEGORY_LABELS } from "@/lib/certificates";
import { computeContentHash } from "@/lib/certificates-server";
import { CheckCircle2, XCircle, ShieldQuestion } from "lucide-react";

/**
 * GET /verify/[serialNumber] — a real, public, server-rendered page (not
 * part of the client-side SPA shell, same pattern as /preservation-manifest
 * and /article/[id]) so a certificate's printed QR code and verification
 * URL resolve to something crawlable and shareable independent of the SPA's
 * client-side zustand routing.
 *
 * "Cryptographically verifiable" here means: the certificate's content hash
 * is recomputed from the fields actually stored on its database row and
 * compared to the hash printed on the document. Any alteration to a
 * downloaded/printed certificate — a changed name, date, or category — will
 * not match. This is deliberately NOT described as blockchain-verified;
 * verification here depends on this platform's own database, not a
 * decentralized ledger (see src/lib/certificates.ts for why).
 */
export async function generateMetadata(
  { params }: { params: Promise<{ serialNumber: string }> }
): Promise<Metadata> {
  const { serialNumber } = await params;
  return {
    title: `Verify certificate ${serialNumber} — Eleventh Press International Publishing`,
    description: "Verify the authenticity of an Eleventh Press International Publishing certificate.",
  };
}

export const dynamic = "force-dynamic";

export default async function VerifyCertificatePage(
  { params }: { params: Promise<{ serialNumber: string }> }
) {
  const { serialNumber } = await params;
  const certificate = await db.certificate.findUnique({ where: { serialNumber } });

  if (!certificate) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <ShieldQuestion className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 font-display text-2xl font-semibold">No certificate found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Serial number <code className="font-mono">{serialNumber}</code> does not match any certificate
          on record. If you scanned a QR code or followed a link, double-check it was copied correctly.
        </p>
      </main>
    );
  }

  const recomputedHash = computeContentHash({
    serialNumber: certificate.serialNumber,
    type: certificate.type as any,
    category: certificate.category as any,
    recipientName: certificate.recipientName,
    issuedAtIso: certificate.issuedAt.toISOString(),
    journalName: certificate.journalName,
    issn: certificate.issn,
    workTitle: certificate.workTitle,
  });
  const valid = recomputedHash === certificate.contentHash;

  return (
    <main className="mx-auto max-w-xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="eyebrow">Certificate verification</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">{certificate.journalName}</h1>
      {certificate.issn && <p className="mt-1 text-sm text-muted-foreground">ISSN {certificate.issn}</p>}

      <section className={`mt-8 rounded-md border p-5 ${valid ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
        <div className="flex items-center gap-2">
          {valid ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <XCircle className="h-5 w-5 text-red-600" />
          )}
          <p className={`font-display text-lg font-semibold ${valid ? "text-emerald-800" : "text-red-800"}`}>
            {valid ? "Verified — this certificate is authentic" : "Verification failed — hash mismatch"}
          </p>
        </div>
        <p className={`mt-1 text-sm ${valid ? "text-emerald-700" : "text-red-700"}`}>
          {valid
            ? "The content hash recomputed from our records matches the certificate on file."
            : "The recomputed hash does not match the record on file. Do not treat this certificate as valid."}
        </p>
      </section>

      <dl className="mt-6 space-y-3 rounded-md border border-border bg-card p-5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Document type</dt>
          <dd className="font-medium">{CERTIFICATE_TYPE_LABELS[certificate.type as keyof typeof CERTIFICATE_TYPE_LABELS]}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Issued to</dt>
          <dd className="font-medium">{certificate.recipientName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Capacity</dt>
          <dd className="font-medium">{CERTIFICATE_CATEGORY_LABELS[certificate.category as keyof typeof CERTIFICATE_CATEGORY_LABELS]}</dd>
        </div>
        {certificate.workTitle && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Work cited</dt>
            <dd className="text-right font-medium">{certificate.workTitle}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Issued</dt>
          <dd className="font-medium">
            {certificate.issuedAt.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Serial number</dt>
          <dd className="font-mono text-xs">{certificate.serialNumber}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Content hash (SHA-256)</dt>
          <dd className="break-all font-mono text-xs">{certificate.contentHash}</dd>
        </div>
      </dl>

      <p className="mt-6 text-xs text-muted-foreground">
        This certificate is cryptographically verifiable and tamper-evident: any alteration to a
        downloaded or printed copy — a changed name, date, or capacity — will not match the hash above.
        Verification depends on Eleventh Press International Publishing's own records, not a
        decentralized blockchain ledger.
      </p>
    </main>
  );
}
