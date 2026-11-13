import type { Metadata } from "next";
import { cache } from "react";
import QRCode from "qrcode";
import { ShieldQuestion } from "lucide-react";
import { getCurrentTenant } from "@/lib/tenant";
import { loadProvenanceRecord } from "@/lib/article-provenance-record";
import { ProvenanceVerifyView } from "@/components/provenance/provenance-verify-view";

// One live verification per request, shared by generateMetadata and the page.
const getRecord = cache(loadProvenanceRecord);

/**
 * GET /verify/article/[id] — the real, public, server-rendered verification
 * page for a published work's digital provenance (same pattern as
 * /verify/[serialNumber] for Certificates). See src/lib/article-provenance.ts
 * for what's actually hashed, and src/lib/article-provenance-record.ts for
 * everything shown here — the downloadable PDF certificate
 * (/api/articles/[id]/verify/certificate) renders from the same record.
 *
 * "Cryptographically verifiable" means the content hash is recomputed from
 * the fields actually stored on this row (plus a fresh hash of the actual
 * PDF/EPUB bytes in storage) on every request and compared to the sealed
 * hash. Deliberately NOT described as blockchain-verified — verification
 * depends on this platform's own database and storage. It also does not
 * restrict use: every article here is CC BY 4.0.
 */
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const lookup = await getRecord(id).catch(() => null);
  const title = lookup && lookup.kind !== "not-found" ? (lookup.kind === "sealed" ? lookup.record.title : lookup.title) : id;
  const tenant = await getCurrentTenant().catch(() => null);
  const site = tenant && !tenant.isPlatform ? tenant.siteName || tenant.name : "Eleventh Press International Publishing";
  const publisher = lookup?.kind === "sealed" ? lookup.record.brand.publisher : site;
  return {
    title: `Provenance verification — ${title} — ${publisher}`,
    description: "Live cryptographic verification of a published work's digital provenance, with a downloadable PDF certificate.",
  };
}

export const dynamic = "force-dynamic";

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6 lg:px-8">
      <ShieldQuestion className="mx-auto h-10 w-10 text-amber-500" />
      <h1 className="mt-4 font-display text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </main>
  );
}

export default async function VerifyArticlePage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lookup = await getRecord(id);

  if (lookup.kind === "not-found") {
    return (
      <Notice title="No published article found">
        Article ID <code className="font-mono">{id}</code> does not match any published record. If you scanned a link from a
        downloaded PDF/EPUB, double-check it was copied correctly.
      </Notice>
    );
  }

  if (lookup.kind === "unsealed") {
    return (
      <Notice title="Not yet sealed">
        &ldquo;{lookup.title}&rdquo; was published before digital provenance sealing existed, or sealing failed at publish time.
        It is still a real, CC BY 4.0 published record — it just has no cryptographic seal to verify here yet.
      </Notice>
    );
  }

  const qrSvg = await QRCode.toString(lookup.record.urls.verify, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 0,
    color: { dark: "#241b3a", light: "#ffffff" },
  });
  const qrDataUrl = `data:image/svg+xml;base64,${Buffer.from(qrSvg).toString("base64")}`;

  return <ProvenanceVerifyView record={lookup.record} qrDataUrl={qrDataUrl} />;
}
