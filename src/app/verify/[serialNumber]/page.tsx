import type { Metadata } from "next";
import { cache } from "react";
import QRCode from "qrcode";
import { ShieldQuestion } from "lucide-react";
import { getCurrentTenant } from "@/lib/tenant";
import { loadCertificateRecord } from "@/lib/certificate-verification-record";
import { CertificateVerifyView } from "@/components/certificates/certificate-verify-view";

// One live verification per request, shared by generateMetadata and the page.
const getRecord = cache((serial: string) => loadCertificateRecord(serial));

/**
 * GET /verify/[serialNumber] — the public, server-rendered verification page
 * a certificate's printed QR code and URL resolve to. Same design as the
 * article provenance page (/verify/article/[id]). See
 * src/lib/certificate-verification-record.ts for the check itself: the
 * content hash is recomputed from the stored record on every request and
 * compared with the hash printed on the certificate. Deliberately NOT
 * described as blockchain-verified.
 */
export async function generateMetadata({ params }: { params: Promise<{ serialNumber: string }> }): Promise<Metadata> {
  const { serialNumber } = await params;
  const lookup = await getRecord(serialNumber).catch(() => null);
  const what = lookup?.kind === "found" ? `${lookup.record.typeLabel} ${lookup.record.serialNumber}` : `certificate ${serialNumber}`;
  // Named after the certificate's issuing publisher (a whitelabel tenant's
  // institution), or the visiting site when the serial is unknown.
  const tenant = await getCurrentTenant().catch(() => null);
  const site = tenant && !tenant.isPlatform ? tenant.siteName || tenant.name : "Eleventh Press International Publishing™";
  const issuer = lookup?.kind === "found" && lookup.record.issuer ? lookup.record.issuer : site;
  return {
    title: `Verify ${what} — ${issuer}`,
    description: `Live cryptographic verification of a ${issuer} certificate, with a downloadable verification report.`,
  };
}

export const dynamic = "force-dynamic";

export default async function VerifyCertificatePage({ params }: { params: Promise<{ serialNumber: string }> }) {
  const { serialNumber } = await params;
  const lookup = await getRecord(serialNumber);

  if (lookup.kind === "not-found") {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <ShieldQuestion className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 font-display text-2xl font-semibold">No certificate found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Serial number <code className="font-mono">{serialNumber}</code> does not match any certificate on record. If you scanned a QR
          code or followed a link, double-check it was copied correctly.
        </p>
      </main>
    );
  }

  const qrSvg = await QRCode.toString(lookup.record.urls.verify, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 0,
    color: { dark: "#241b3a", light: "#ffffff" },
  });
  const qrDataUrl = `data:image/svg+xml;base64,${Buffer.from(qrSvg).toString("base64")}`;
  return <CertificateVerifyView record={lookup.record} qrDataUrl={qrDataUrl} />;
}
