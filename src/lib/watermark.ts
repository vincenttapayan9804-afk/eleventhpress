/**
 * Per-download provenance stamping — the traceability half of the
 * platform's "Seal of Quality" (see src/lib/article-provenance.ts for the
 * content-hash half). Every PDF/EPUB handed to a reader gets a real,
 * unique stamp: a visible footer/banner naming who downloaded it, when,
 * and under what license, plus the same information embedded as file
 * metadata. Any copy that later surfaces elsewhere can be traced back to
 * this stamp — a real deterrent and evidence trail for misattribution or
 * license violations.
 *
 * This is deliberately NOT DRM. Every article here is CC BY 4.0, which
 * already permits redistribution and commercial reuse with attribution —
 * stamping does not, and is not meant to, restrict any of that. It only
 * makes provenance traceable, the way a library's accession stamp or a
 * museum loan tag does.
 *
 * Pure JS throughout (pdf-lib for the PDF path, this project's own
 * zip-writer for the EPUB path) — no native binaries, consistent with
 * every other document-generation module in this codebase.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { buildZip, unzip } from "@/lib/zip-writer";

export interface DownloadStamp {
  downloadId: string;
  label: string; // real name, or "Anonymous reader"
  timestampLabel: string; // human-readable, e.g. "19 July 2026"
  doi: string | null;
  verifyUrl: string;
}

function escapeXml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&apos;";
      default: return c;
    }
  });
}

function stampLine(stamp: DownloadStamp): string {
  const cite = stamp.doi ? ` · doi.org/${stamp.doi}` : "";
  return `Downloaded by ${stamp.label} on ${stamp.timestampLabel} for use under CC BY 4.0 (attribution required, redistribution permitted)${cite} · Download ID ${stamp.downloadId} · Verify: ${stamp.verifyUrl}`;
}

/**
 * Stamps an already-generated galley PDF: a small visible footer line on
 * every page (survives cropping/screenshotting a single page) plus the
 * same provenance packed into the PDF's standard Info dictionary (Subject/
 * Keywords) — real, inspectable file metadata, not steganography.
 */
export async function stampPdf(pdfBytes: Buffer, stamp: DownloadStamp): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const line = stampLine(stamp);
  const maroon = rgb(0.478, 0.122, 0.169);

  for (const page of pdfDoc.getPages()) {
    const { width } = page.getSize();
    const fontSize = 5.5;
    // Sits in the page's outer margin, just above the physical edge — below
    // the galley's own publisher/page-number footer line, so the two never
    // overlap (src/lib/galley.ts draws its footer higher up, at
    // page.height - margins.bottom + 18).
    page.drawText(line, {
      x: 24,
      y: 8,
      size: fontSize,
      font,
      color: maroon,
      maxWidth: width - 48,
    });
  }

  // Subject/Keywords are the real, inspectable carriers of the stamp — the
  // Producer field is not set here because pdf-lib's save() unconditionally
  // overwrites it with its own library string regardless of what's set
  // beforehand.
  pdfDoc.setSubject(line);
  pdfDoc.setKeywords([
    "license:CC-BY-4.0",
    `download-id:${stamp.downloadId}`,
    stamp.doi ? `doi:${stamp.doi}` : "doi:unknown",
    `verify:${stamp.verifyUrl}`,
  ]);

  return Buffer.from(await pdfDoc.save());
}

/**
 * Stamps an already-generated EPUB: a visible banner appended to the end
 * of the first chapter's body (readable in-flow, not just in a "details"
 * screen) plus the same provenance in the OPF package metadata (dc:rights
 * + a custom meta element) — the EPUB-spec-correct place for it.
 */
export function stampEpub(epubBytes: Buffer, stamp: DownloadStamp): Buffer {
  const entries = unzip(epubBytes);
  const line = stampLine(stamp);

  const opfEntry = entries.find((e) => e.name === "OEBPS/content.opf");
  if (opfEntry) {
    const opf = opfEntry.data.toString("utf-8");
    const injected =
      `    <dc:rights>${escapeXml(line)}</dc:rights>\n` +
      `    <meta property="epip:downloadId">${escapeXml(stamp.downloadId)}</meta>\n` +
      `  </metadata>`;
    opfEntry.data = Buffer.from(opf.replace("</metadata>", injected), "utf-8");
  }

  const chapterEntry = entries.find((e) => e.name === "OEBPS/chapter-1.xhtml");
  if (chapterEntry) {
    const html = chapterEntry.data.toString("utf-8");
    const banner =
      `<p style="font-size:0.65rem;color:#7A1F2B;border-top:1px solid #c9a55c;` +
      `padding-top:0.5em;margin-top:2em;">${escapeXml(line)}</p>`;
    chapterEntry.data = Buffer.from(html.replace("</body>", `${banner}</body>`), "utf-8");
  }

  return buildZip(entries);
}
