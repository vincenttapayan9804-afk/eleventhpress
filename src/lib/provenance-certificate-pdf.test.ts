/// <reference types="bun-types" />
/**
 * The downloadable Certificate of Digital Provenance
 * (src/lib/provenance-certificate-pdf.ts): renders a real multi-page PDF for
 * every verdict, carries the required watermark on every page, and never
 * prints characters the standard WinAnsi fonts can't encode.
 */
import { describe, test, expect } from "bun:test";
import { PDFDocument } from "pdf-lib";
import { inflateSync } from "zlib";
import { buildProvenanceCertificatePdf, paletteFor, pdfSafe, PLATFORM_PALETTE, PROVENANCE_WATERMARK, provenanceCertificateFileName } from "./provenance-certificate-pdf";
import { POWERED_BY_CREDIT } from "./powered-by";
import type { ProvenanceRecord } from "./article-provenance-record";

function record(overrides: Partial<ProvenanceRecord> = {}): ProvenanceRecord {
  const now = new Date().toISOString();
  return {
    id: "art_1",
    sealReference: "EPIP-PV-2026-2D8B4D75",
    verdict: "verified",
    unavailable: [],
    checks: { metadata: true, pdf: true, epub: true },
    checkedAt: now,
    title: "Classroom Learning Environment and Institutional Support",
    abstract: "Abstract.",
    authors: [{ name: "Lyn Hinampas", affiliation: "Đại học Quốc gia", orcid: "0000-0002-1825-0097" }],
    contentTypeLabel: "Research article",
    insightCategoryLabel: null,
    discipline: "Education",
    keywords: ["MSLQ", "TLE"],
    journal: { name: "EPIP Journal", issn: null, publisher: "Eleventh Press International Publishing™" },
    issue: null,
    versionNumber: 1,
    reviewModelLabel: "Double-blind peer review",
    integrityStatus: "NORMAL",
    integrityStatusLabel: "No post-publication notices",
    corrections: [],
    funders: [],
    doi: "10.5072/zenodo.564914",
    doiStatus: "REGISTERED",
    zenodoRecordId: "564914",
    license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
    dates: { submittedAt: null, acceptedAt: null, publishedAt: "2026-07-14T00:00:00Z", sealedAt: now },
    hashes: { content: "2d8b4d75d966b44d7e5de0949ae8dd7d900c778a24471c07e57998258150ed54", pdf: "a".repeat(64), epub: null },
    sealVersion: 1,
    currentSealVersion: 1,
    sealCount: 2,
    timeline: [
      { at: "2026-07-14T00:00:00Z", kind: "published", label: "Published" },
      { at: now, kind: "verified", label: "Independently re-verified (this check)" },
    ],
    citations: [{ id: "apa", label: "APA 7", text: "Hinampas, L. (2026). Classroom learning environment. https://doi.org/10.5072/zenodo.564914" }],
    urls: {
      verify: "https://example.org/verify/article/art_1",
      article: "https://example.org/article/art_1",
      api: "https://example.org/api/articles/art_1/verify",
      certificate: "https://example.org/api/articles/art_1/verify/certificate",
      doi: "https://doi.org/10.5072/zenodo.564914",
    },
    ...overrides,
  };
}

/** The text drawn on each page, decoded from PDFKit's hex-string TJ arrays. */
async function pageTexts(pdf: Buffer): Promise<string[]> {
  const doc = await PDFDocument.load(pdf);
  return doc.getPages().map((page) => {
    const contents = page.node.Contents();
    const streams: any[] = contents && "asArray" in contents ? (contents as any).asArray() : [contents];
    let out = "";
    for (const ref of streams) {
      const stream: any = doc.context.lookup(ref);
      const raw = Buffer.from(stream.getContents());
      let body: string;
      try { body = inflateSync(raw).toString("latin1"); } catch { body = raw.toString("latin1"); }
      // Each TJ array is <hex> strings interleaved with kerning offsets.
      for (const [, arr] of body.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
        out += [...arr.matchAll(/<([0-9a-fA-F]*)>/g)].map(([, hex]) => Buffer.from(hex, "hex").toString("latin1")).join("").replace(/\x99/g, "\u2122") + "\n"; // WinAnsi 0x99 is ™
      }
    }
    return out;
  });
}

describe("provenance certificate PDF", () => {
  for (const verdict of ["verified", "mismatch", "unavailable"] as const) {
    test(`renders a valid PDF for a '${verdict}' verdict`, async () => {
      const pdf = await buildProvenanceCertificatePdf(record({ verdict, unavailable: verdict === "unavailable" ? ["PDF"] : [] }));
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      const doc = await PDFDocument.load(pdf);
      expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
      expect(doc.getTitle()).toContain("Certificate of Digital Provenance");
    });
  }

  test("every page carries the publisher watermark", async () => {
    const texts = await pageTexts(await buildProvenanceCertificatePdf(record()));
    expect(texts.length).toBeGreaterThan(1);
    for (const t of texts) expect(t).toContain(PROVENANCE_WATERMARK);
    expect(PROVENANCE_WATERMARK).toBe("Published at Eleventh Press International Publishing™");
  });

  test("a whitelabel tenant's certificate names the tenant and carries the fixed platform credit", async () => {
    const brand = { whitelabel: true, publisher: "Ron Publishing", primaryHex: "#0f766e", accentHex: "#f59e0b" };
    const texts = await pageTexts(await buildProvenanceCertificatePdf(record({ brand } as Partial<ProvenanceRecord>)));
    for (const t of texts) {
      expect(t).toContain("Published at Ron Publishing");
      expect(t).toContain(POWERED_BY_CREDIT);
    }
  });

  test("the platform's own certificate has no credit line", async () => {
    const texts = await pageTexts(await buildProvenanceCertificatePdf(record()));
    for (const t of texts) expect(t).not.toContain(POWERED_BY_CREDIT);
  });

  test("paletteFor keeps purple/gold for the platform and uses tenant colours otherwise", () => {
    expect(paletteFor(null)).toEqual(PLATFORM_PALETTE);
    expect(paletteFor({ whitelabel: false, primaryHex: "#0f766e" })).toEqual(PLATFORM_PALETTE);
    const p = paletteFor({ whitelabel: true, primaryHex: "#0f766e", accentHex: "#f59e0b" });
    expect(p.purple).toBe("#0f766e");
    expect(p.gold).toBe("#f59e0b");
    expect(p.purpleDeep).not.toBe("#0f766e");
    // A tenant with no colours of its own keeps the default design.
    expect(paletteFor({ whitelabel: true })).toEqual(PLATFORM_PALETTE);
  });

  test("pdfSafe folds non-WinAnsi letters instead of printing mojibake", () => {
    expect(pdfSafe("Đại học Quốc gia")).toBe("Dai hoc Quoc gia");
    expect(pdfSafe("Students’ “motivated” — strategies")).toBe("Students’ “motivated” — strategies");
    expect(pdfSafe("日本")).toBe("??");
  });

  test("certificate filename is derived from the DOI", () => {
    expect(provenanceCertificateFileName(record())).toBe("provenance-certificate-10-5072-zenodo-564914.pdf");
  });
});
