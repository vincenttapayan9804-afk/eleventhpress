/**
 * Certificate of Digital Provenance — the downloadable PDF counterpart of
 * /verify/article/[id]. Same PDFKit renderer family and purple/gold palette
 * as src/lib/certificate-pdf.ts and src/lib/galley.ts (pure JS, standard
 * fonts, no native binaries — runs on Vercel's serverless runtime).
 *
 * Renders from the exact ProvenanceRecord the page renders from
 * (src/lib/article-provenance-record.ts), so the verdict printed here is the
 * one computed live for this download, never a cached flag. Every page
 * carries the diagonal "Published at Eleventh Press International
 * Publishing" watermark, a running footer with the seal reference and page
 * count, and a QR code back to the live verification page — the printed
 * certificate is a dated snapshot; the live page stays authoritative.
 */
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { ProvenanceRecord, ProvenanceTimelineEvent } from "@/lib/article-provenance-record";
import { SEALED_FIELDS } from "@/lib/article-provenance";
import type { ProvenanceCheckResult } from "@/lib/article-provenance-server";
import { mixHex, normalizeHex } from "@/lib/brand-colors";
import { POWERED_BY_CREDIT } from "@/lib/powered-by";
import { withTrademark } from "@/lib/brand-mark";

export const PROVENANCE_WATERMARK = "Published at Eleventh Press International Publishing™";

/** Diagonal watermark naming the publisher that issued the work (a whitelabel tenant, or the platform). */
export function provenanceWatermark(publisher: string | null | undefined): string {
  return publisher ? `Published at ${withTrademark(publisher)}` : PROVENANCE_WATERMARK;
}

export const PURPLE = "#4c1d95";
export const PURPLE_DEEP = "#2a1458";
export const GOLD = "#c9a55c";
export const GOLD_DEEP = "#8a6a28";
export const INK = "#241b3a";

/** The four brand tones a report is drawn in. */
export interface DocPalette {
  purple: string;
  purpleDeep: string;
  gold: string;
  goldDeep: string;
}

export const PLATFORM_PALETTE: DocPalette = Object.freeze({ purple: PURPLE, purpleDeep: PURPLE_DEEP, gold: GOLD, goldDeep: GOLD_DEEP });

/**
 * A whitelabel tenant's report palette: its primary colour replaces the
 * purple, its accent replaces the gold (each with a deeper shade derived
 * from it). The platform — and a tenant that hasn't set colours — keeps
 * the purple/gold design exactly.
 */
export function paletteFor(brand: { whitelabel?: boolean; primaryHex?: string | null; accentHex?: string | null } | null | undefined): DocPalette {
  if (!brand?.whitelabel) return PLATFORM_PALETTE;
  const primary = normalizeHex(brand.primaryHex) ?? PURPLE;
  const accent = normalizeHex(brand.accentHex) ?? GOLD;
  return {
    purple: primary,
    purpleDeep: primary === PURPLE ? PURPLE_DEEP : mixHex(primary, "#000000", 0.45),
    gold: accent,
    goldDeep: accent === GOLD ? GOLD_DEEP : mixHex(accent, "#000000", 0.45),
  };
}

/** Extra inputs for a whitelabel report. */
export interface ReportBranding {
  /** The tenant logo as PNG, drawn in the cover band. */
  logoPng?: Buffer | null;
}
export const MUTED = "#6b6478";
export const RULE = "#e4dfee";
export const TINT = "#f7f4fc";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 54;
const CW = PAGE_W - 2 * M;
const BOTTOM_LIMIT = PAGE_H - 78;

const VERDICT_STYLE = {
  verified: { fill: "#ecfdf5", stroke: "#34d399", ink: "#065f46", accent: "#059669", head: "VERIFIED — THIS RECORD IS AUTHENTIC" },
  unavailable: { fill: "#fffbeb", stroke: "#fbbf24", ink: "#92400e", accent: "#d97706", head: "VERIFICATION TEMPORARILY UNAVAILABLE" },
  mismatch: { fill: "#fef2f2", stroke: "#f87171", ink: "#991b1b", accent: "#dc2626", head: "VERIFICATION FAILED — HASH MISMATCH" },
} as const;

/** PDFKit's standard fonts are WinAnsi-encoded: fold accents and drop
 * anything outside that set so a name like "Đặng" prints as "Dang" instead of
 * mojibake. Curly quotes, dashes and the bullet survive. */
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
// Letters NFKD can't fold to ASCII (no combining-mark decomposition).
const LATIN_FOLD: Record<string, string> = { "Đ": "D", "đ": "d", "Ł": "L", "ł": "l", "Ħ": "H", "ħ": "h", "ı": "i", "Œ": "OE", "œ": "oe", "ŋ": "ng", "Ŋ": "NG" };
export function pdfSafe(input: string | null | undefined): string {
  if (!input) return "";
  let out = "";
  for (const ch of input.normalize("NFC")) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 9 || code === 10 || (code >= 32 && code <= 126) || (code >= 160 && code <= 255) || WIN_ANSI_EXTRA.has(ch)) {
      out += ch;
      continue;
    }
    if (LATIN_FOLD[ch]) {
      out += LATIN_FOLD[ch];
      continue;
    }
    const folded = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
    out += [...folded].every((c) => (c.codePointAt(0) ?? 0) < 256) ? folded : "?";
  }
  return out;
}

export function fmtDate(isoStr: string | null | undefined, withTime = false): string {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  const date = d.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  if (!withTime) return date;
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${date}, ${time} UTC`;
}

export function drawCheckGlyph(doc: PDFKit.PDFDocument, cx: number, cy: number, r: number, color: string) {
  doc.save().lineWidth(Math.max(1.2, r * 0.22)).lineCap("round").lineJoin("round").strokeColor(color)
    .moveTo(cx - r * 0.45, cy + r * 0.02).lineTo(cx - r * 0.1, cy + r * 0.38).lineTo(cx + r * 0.5, cy - r * 0.34).stroke().restore();
}
export function drawCrossGlyph(doc: PDFKit.PDFDocument, cx: number, cy: number, r: number, color: string) {
  doc.save().lineWidth(Math.max(1.2, r * 0.22)).lineCap("round").strokeColor(color)
    .moveTo(cx - r * 0.36, cy - r * 0.36).lineTo(cx + r * 0.36, cy + r * 0.36)
    .moveTo(cx + r * 0.36, cy - r * 0.36).lineTo(cx - r * 0.36, cy + r * 0.36).stroke().restore();
}
function drawBangGlyph(doc: PDFKit.PDFDocument, cx: number, cy: number, r: number, color: string) {
  doc.save().lineWidth(Math.max(1.2, r * 0.22)).lineCap("round").strokeColor(color)
    .moveTo(cx, cy - r * 0.45).lineTo(cx, cy + r * 0.12).stroke()
    .circle(cx, cy + r * 0.42, r * 0.09).fill(color).restore();
}

/** Gold-ringed seal emblem with the verdict glyph at its centre. */
export function drawSeal(doc: PDFKit.PDFDocument, cx: number, cy: number, r: number, verdict: ProvenanceRecord["verdict"], pal: DocPalette = PLATFORM_PALETTE) {
  const { gold: GOLD, goldDeep: GOLD_DEEP } = pal;
  const s = VERDICT_STYLE[verdict];
  doc.save();
  doc.circle(cx, cy, r).fill(doc.radialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r).stop(0, "#fbf0cd").stop(0.6, GOLD).stop(1, GOLD_DEEP));
  // Notched outer ring — 24 small ticks, like an embossed seal edge.
  doc.lineWidth(0.6).strokeColor(GOLD_DEEP);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    doc.moveTo(cx + Math.cos(a) * (r - 3.2), cy + Math.sin(a) * (r - 3.2)).lineTo(cx + Math.cos(a) * (r - 0.8), cy + Math.sin(a) * (r - 0.8)).stroke();
  }
  doc.circle(cx, cy, r * 0.7).fill("#ffffff");
  doc.circle(cx, cy, r * 0.7).lineWidth(0.8).strokeColor(GOLD_DEEP).stroke();
  doc.restore();
  if (verdict === "verified") drawCheckGlyph(doc, cx, cy, r * 0.62, s.accent);
  else if (verdict === "unavailable") drawBangGlyph(doc, cx, cy, r * 0.62, s.accent);
  else drawCrossGlyph(doc, cx, cy, r * 0.62, s.accent);
}

/** The content hash as a row of 64 tinted cells, one per hex nibble — a
 * quick visual cross-check against the same strip on the live page. */
export function drawFingerprint(doc: PDFKit.PDFDocument, hash: string, x: number, y: number, w: number, h: number, pal: DocPalette = PLATFORM_PALETTE) {
  const { purple: PURPLE, goldDeep: GOLD_DEEP } = pal;
  const nibbles = hash.slice(0, 64).split("");
  const cell = w / nibbles.length;
  nibbles.forEach((n, i) => {
    const v = parseInt(n, 16);
    doc.save().fillOpacity(0.12 + (v / 15) * 0.88).rect(x + i * cell, y, cell - 0.6, h).fill(i % 2 === 0 ? PURPLE : GOLD_DEEP).restore();
  });
}

export async function buildProvenanceCertificatePdf(record: ProvenanceRecord, branding: ReportBranding = {}): Promise<Buffer> {
  // Whitelabel: the publishing tenant's colours replace the purple/gold.
  const pal = paletteFor(record.brand);
  const { purple: PURPLE, purpleDeep: PURPLE_DEEP, gold: GOLD, goldDeep: GOLD_DEEP } = pal;
  const credit = record.brand?.whitelabel ? POWERED_BY_CREDIT : null;
  const qr = await QRCode.toBuffer(record.urls.verify, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 260,
    color: { dark: INK, light: "#ffffff" },
  });

  const publisher = pdfSafe(record.brand?.publisher || record.journal.publisher || "Eleventh Press International Publishing™");
  const watermark = pdfSafe(provenanceWatermark(publisher));

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: M, bottom: 60, left: M, right: M },
      bufferPages: true,
      info: {
        Title: pdfSafe(`Certificate of Digital Provenance — ${record.title}`),
        Author: publisher,
        Subject: pdfSafe(`Provenance verification ${record.sealReference} · ${record.verdict} · checked ${record.checkedAt}`),
        Keywords: pdfSafe(`digital provenance, SHA-256, ${record.doi ?? record.id}, ${watermark}`),
        Creator: `${publisher} — provenance service`,
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const style = VERDICT_STYLE[record.verdict];
    let sectionNo = 0;

    const runningHeader = () => {
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor(GOLD_DEEP)
        .text("CERTIFICATE OF DIGITAL PROVENANCE", M, 34, { characterSpacing: 1.6, lineBreak: false });
      doc.font("Courier").fontSize(7).fillColor(MUTED)
        .text(record.sealReference, M, 34, { width: CW, align: "right", lineBreak: false });
      doc.moveTo(M, 47).lineTo(M + CW, 47).lineWidth(0.5).strokeColor(RULE).stroke();
      doc.y = 64;
    };
    const ensure = (h: number) => {
      if (doc.y + h > BOTTOM_LIMIT) {
        doc.addPage();
        runningHeader();
      }
    };
    // `keepWith` = height of the first block after the heading, so a heading
    // is never stranded at the foot of a page without its content.
    const section = (title: string, keepWith = 40) => {
      ensure(40 + keepWith);
      doc.y += 14;
      sectionNo += 1;
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(8).fillColor(GOLD_DEEP).text(String(sectionNo).padStart(2, "0"), M, y + 2, { lineBreak: false });
      doc.font("Times-Bold").fontSize(12.5).fillColor(PURPLE).text(title, M + 20, y, { lineBreak: false });
      doc.moveTo(M, y + 18).lineTo(M + CW, y + 18).lineWidth(0.6).strokeColor(GOLD).stroke();
      doc.y = y + 26;
    };
    const kvGrid = (rows: [string, string][]) => {
      const gap = 18;
      const colW = (CW - gap) / 2;
      for (let i = 0; i < rows.length; i += 2) {
        const pair = rows.slice(i, i + 2);
        doc.font("Helvetica").fontSize(9);
        const h = Math.max(...pair.map(([, v]) => doc.heightOfString(pdfSafe(v) || "—", { width: colW }))) + 18;
        ensure(h);
        const y = doc.y;
        pair.forEach(([k, v], j) => {
          const x = M + j * (colW + gap);
          doc.font("Helvetica-Bold").fontSize(6.3).fillColor(MUTED).text(k.toUpperCase(), x, y, { width: colW, characterSpacing: 0.9, lineBreak: false });
          doc.font("Helvetica").fontSize(9).fillColor(INK).text(pdfSafe(v) || "—", x, y + 9, { width: colW });
        });
        doc.moveTo(M, y + h - 4).lineTo(M + CW, y + h - 4).lineWidth(0.4).strokeColor(RULE).stroke();
        doc.y = y + h;
      }
    };

    // ── Cover band ─────────────────────────────────────────────────────
    doc.rect(0, 0, PAGE_W, 112).fill(doc.linearGradient(0, 0, PAGE_W, 112).stop(0, PURPLE_DEEP).stop(1, PURPLE));
    doc.rect(0, 112, PAGE_W, 2.2).fill(GOLD);
    // Tenant logo on a white tile at the left of the band; the band text shifts right to make room.
    let bx = M;
    if (branding.logoPng) {
      try {
        doc.save().roundedRect(M, 28, 56, 56, 6).fill("#ffffff").restore();
        doc.image(branding.logoPng, M + 4, 32, { fit: [48, 48], align: "center", valign: "center" });
        bx = M + 68;
      } catch {
        /* unreadable logo — the publisher name still identifies the issuer */
      }
    }
    doc.font("Helvetica-Bold").fontSize(7.2).fillColor(GOLD)
      .text(publisher.toUpperCase(), bx, 30, { characterSpacing: 2.2, lineBreak: false, width: CW - 150 - (bx - M), ellipsis: true });
    doc.font("Times-Bold").fontSize(bx > M ? 19 : 23).fillColor("#ffffff").text("Certificate of Digital Provenance", bx, 46, { lineBreak: false });
    doc.font("Helvetica").fontSize(8.2).fillColor("#d9cff0")
      .text("Cryptographic integrity verification of a published scholarly record", bx, 76, { lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(6.3).fillColor(GOLD).text("SEAL REFERENCE", M, 30, { width: CW, align: "right", characterSpacing: 1.2, lineBreak: false });
    doc.font("Courier-Bold").fontSize(10).fillColor("#ffffff").text(record.sealReference, M, 41, { width: CW, align: "right", lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(6.3).fillColor(GOLD).text("ISSUED", M, 60, { width: CW, align: "right", characterSpacing: 1.2, lineBreak: false });
    doc.font("Helvetica").fontSize(8.2).fillColor("#ffffff").text(fmtDate(record.checkedAt, true), M, 70, { width: CW, align: "right", lineBreak: false });

    // ── Verdict panel ──────────────────────────────────────────────────
    const vy = 134;
    const vh = 84;
    doc.roundedRect(M, vy, CW, vh, 8).fillAndStroke(style.fill, style.stroke);
    drawSeal(doc, M + 44, vy + vh / 2, 28, record.verdict, pal);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(style.ink).text(style.head, M + 88, vy + 16, { width: CW - 100, characterSpacing: 0.4 });
    const verdictBody =
      record.verdict === "verified"
        ? "The SHA-256 content hash recomputed from the stored record, and the file hashes recomputed from the actual stored PDF/EPUB bytes, all match the sealed record at the time this certificate was issued."
        : record.verdict === "unavailable"
          ? `The ${record.unavailable.join(" and ")} file could not be read from storage when this certificate was issued, so it could not be re-hashed. This is not evidence of tampering — re-verify online.`
          : "A recomputed hash does not match the sealed record. Do not treat this article's metadata or files as unaltered since they were sealed.";
    doc.font("Helvetica").fontSize(8.6).fillColor(style.ink).text(verdictBody, M + 88, vy + 34, { width: CW - 104, lineGap: 1.2 });

    // ── Work under verification ────────────────────────────────────────
    doc.y = vy + vh + 22;
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor(PURPLE).text("WORK UNDER VERIFICATION", M, doc.y, { characterSpacing: 1.6 });
    doc.moveDown(0.35);
    doc.font("Times-Bold").fontSize(15.5).fillColor(INK).text(pdfSafe(record.title), M, doc.y, { width: CW, lineGap: 1 });
    doc.moveDown(0.3);
    const authorLine = record.authors.map((a) => a.name).filter(Boolean).join(", ");
    if (authorLine) doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(pdfSafe(authorLine), { width: CW });
    const journalBits = [
      record.journal.name,
      record.issue ? `Vol. ${record.issue.volume}, No. ${record.issue.issueNumber} (${record.issue.year})` : null,
      record.doi ? `https://doi.org/${record.doi}` : null,
    ].filter(Boolean).join(" · ");
    doc.moveDown(0.15);
    doc.font("Times-Italic").fontSize(9.5).fillColor(MUTED).text(pdfSafe(journalBits), { width: CW });

    // ── 1. Verification checks ─────────────────────────────────────────
    section("Verification checks performed");
    const checkRows: { label: string; detail: string; result: ProvenanceCheckResult }[] = [
      { label: "Record located", detail: `Article ${record.id} exists and is in PUBLISHED status.`, result: true },
      { label: "Metadata re-hashed", detail: "SHA-256 over the canonical, key-ordered JSON of every sealed field equals the sealed content hash.", result: record.checks.metadata },
      { label: "PDF bytes re-hashed", detail: "SHA-256 of the PDF stored in the archive equals the hash recorded in the seal.", result: record.checks.pdf },
      { label: "EPUB bytes re-hashed", detail: "SHA-256 of the EPUB stored in the archive equals the hash recorded in the seal.", result: record.checks.epub },
    ];
    for (const c of checkRows) {
      doc.font("Helvetica").fontSize(8.2);
      const detailH = doc.heightOfString(c.detail, { width: CW - 150 - 64 });
      doc.font("Helvetica-Bold").fontSize(9);
      const labelH = doc.heightOfString(c.label, { width: 150 - 28 });
      const h = Math.max(26, detailH + 14, labelH + 12);
      ensure(h);
      const y = doc.y;
      const color = c.result === true ? "#059669" : c.result === false ? "#dc2626" : c.result === "unavailable" ? "#d97706" : "#9ca3af";
      doc.circle(M + 8, y + 8, 7.5).fill(color);
      if (c.result === true) drawCheckGlyph(doc, M + 8, y + 8, 6.5, "#ffffff");
      else if (c.result === false) drawCrossGlyph(doc, M + 8, y + 8, 6.5, "#ffffff");
      else if (c.result === "unavailable") drawBangGlyph(doc, M + 8, y + 8, 6.5, "#ffffff");
      else doc.save().lineWidth(1.4).strokeColor("#ffffff").moveTo(M + 4.5, y + 8).lineTo(M + 11.5, y + 8).stroke().restore();
      doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text(c.label, M + 24, y + 3, { width: 150 - 28 });
      doc.font("Helvetica").fontSize(8.2).fillColor(MUTED).text(c.detail, M + 150, y + 3, { width: CW - 150 - 64 });
      const tag = c.result === true ? "MATCH" : c.result === false ? "MISMATCH" : c.result === "unavailable" ? "UNREADABLE" : "NOT APPLICABLE";
      doc.font("Helvetica-Bold").fontSize(6.4).fillColor(color).text(tag, M, y + 4, { width: CW, align: "right", characterSpacing: 0.8, lineBreak: false });
      doc.y = y + h;
    }

    // ── 2. Cryptographic fingerprint ───────────────────────────────────
    section("Cryptographic fingerprint");
    kvGrid([
      ["Algorithm", "SHA-256 (FIPS 180-4) over canonical, key-ordered JSON"],
      ["Seal rules version", `v${record.sealVersion} (current: v${record.currentSealVersion})`],
      ["Sealed", fmtDate(record.dates.sealedAt, true)],
      ["Recorded seal events", String(record.sealCount || 1)],
    ]);
    const hashBlock = (label: string, hash: string | null, fingerprint = false) => {
      if (!hash) return;
      ensure(fingerprint ? 58 : 44);
      const y = doc.y + 2;
      doc.font("Helvetica-Bold").fontSize(6.3).fillColor(MUTED).text(label.toUpperCase(), M, y, { characterSpacing: 0.9, lineBreak: false });
      doc.roundedRect(M, y + 10, CW, 20, 4).fillAndStroke(TINT, RULE);
      doc.font("Courier-Bold").fontSize(8.6).fillColor(PURPLE).text(hash, M + 8, y + 16, { width: CW - 16, lineBreak: false, characterSpacing: 0.15 });
      let end = y + 34;
      if (fingerprint) {
        drawFingerprint(doc, hash, M, y + 34, CW, 7, pal);
        end = y + 48;
      }
      doc.y = end;
    };
    hashBlock("Content hash (sealed record)", record.hashes.content, true);
    hashBlock("PDF galley — SHA-256 of stored bytes", record.hashes.pdf);
    hashBlock("EPUB galley — SHA-256 of stored bytes", record.hashes.epub);

    // ── 3. Bibliographic record ────────────────────────────────────────
    section("Bibliographic record");
    const rows: [string, string][] = [
      ["Journal", record.journal.name],
      ["ISSN", record.journal.issn ?? "—"],
      ["Publisher", record.journal.publisher],
      ["Volume / issue", record.issue ? `Vol. ${record.issue.volume}, No. ${record.issue.issueNumber} (${record.issue.year})` : "Continuous publication"],
      ["Content type", record.insightCategoryLabel ? `${record.contentTypeLabel} — ${record.insightCategoryLabel}` : record.contentTypeLabel],
      ["Discipline", record.discipline],
      ["Peer review", record.reviewModelLabel],
      ["Version of record", `Version ${record.versionNumber}`],
      ["DOI", record.doi ? `https://doi.org/${record.doi}` : "Not yet assigned"],
      ["DOI registration", record.doiStatus === "NONE" ? "—" : record.doiStatus.charAt(0) + record.doiStatus.slice(1).toLowerCase()],
      ["Archive record", record.zenodoRecordId ? `Zenodo record ${record.zenodoRecordId}` : "—"],
      ["License", `${record.license.name} — ${record.license.url}`],
      ["Submitted", fmtDate(record.dates.submittedAt)],
      ["Accepted", fmtDate(record.dates.acceptedAt)],
      ["Published", fmtDate(record.dates.publishedAt)],
      ["Post-publication status", record.integrityStatusLabel],
    ];
    if (record.funders.length) rows.push(["Funding", record.funders.join("; ")]);
    if (record.keywords.length) rows.push(["Keywords", record.keywords.join(", ")]);
    kvGrid(rows);

    // ── 4. Authors & affiliations ──────────────────────────────────────
    if (record.authors.length) {
      section("Authors & affiliations");
      record.authors.forEach((a, i) => {
        const sub = [a.affiliation, a.orcid ? `ORCID ${a.orcid.replace(/^https?:\/\/orcid\.org\//, "")}` : null, a.rorId ? `ROR ${a.rorId}` : null]
          .filter(Boolean).join(" · ");
        const roles = a.creditRoles?.length ? `CRediT: ${a.creditRoles.join(", ")}` : "";
        doc.font("Helvetica").fontSize(8.2);
        const h = 14 + (sub ? doc.heightOfString(pdfSafe(sub), { width: CW - 24 }) : 0) + (roles ? doc.heightOfString(roles, { width: CW - 24 }) : 0) + 6;
        ensure(h);
        const y = doc.y;
        doc.font("Helvetica-Bold").fontSize(7).fillColor(GOLD_DEEP).text(String(i + 1), M, y + 1.5, { width: 14, lineBreak: false });
        doc.font("Helvetica-Bold").fontSize(9.2).fillColor(INK).text(pdfSafe(a.name), M + 18, y, { width: CW - 24 });
        if (sub) doc.font("Helvetica").fontSize(8.2).fillColor(MUTED).text(pdfSafe(sub), M + 18, doc.y + 1, { width: CW - 24 });
        if (roles) doc.font("Helvetica-Oblique").fontSize(7.8).fillColor(MUTED).text(roles, M + 18, doc.y + 1, { width: CW - 24 });
        doc.y = Math.max(doc.y, y + h - 6) + 6;
      });
    }

    // ── 5. Provenance timeline ─────────────────────────────────────────
    section("Provenance timeline");
    const events: ProvenanceTimelineEvent[] = record.timeline;
    events.forEach((e, i) => {
      doc.font("Helvetica").fontSize(8);
      const h = 16 + (e.detail ? doc.heightOfString(pdfSafe(e.detail), { width: CW - 150 }) : 0) + 6;
      ensure(h);
      const y = doc.y;
      const dotX = M + 118;
      if (i < events.length - 1) doc.moveTo(dotX, y + 9).lineTo(dotX, y + h + 2).lineWidth(0.8).strokeColor(RULE).stroke();
      const dotColor = e.kind === "verified" ? style.accent : e.kind === "sealed" ? GOLD_DEEP : e.kind === "correction" ? "#d97706" : PURPLE;
      doc.circle(dotX, y + 5, 3.6).fill(dotColor);
      doc.font("Helvetica").fontSize(7.8).fillColor(MUTED).text(fmtDate(e.at, e.kind === "sealed" || e.kind === "verified"), M, y + 1, { width: 106, lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text(pdfSafe(e.label), M + 132, y, { width: CW - 132 });
      if (e.detail) doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(pdfSafe(e.detail), M + 132, doc.y + 1, { width: CW - 132 });
      doc.y = Math.max(doc.y, y + h - 6) + 6;
    });

    // ── 6. Recommended citation ────────────────────────────────────────
    const apa = record.citations.find((c) => c.id === "apa");
    if (apa) {
      doc.font("Times-Roman").fontSize(10);
      const h = doc.heightOfString(pdfSafe(apa.text), { width: CW - 28 }) + 20;
      section("Recommended citation (APA 7)", h);
      ensure(h);
      const y = doc.y;
      doc.rect(M, y, CW, h).fill(TINT);
      doc.rect(M, y, 2.5, h).fill(GOLD);
      doc.font("Times-Roman").fontSize(10).fillColor(INK).text(pdfSafe(apa.text), M + 16, y + 10, { width: CW - 28, lineGap: 1.5 });
      doc.y = y + h;
    }

    // ── 7. Independent verification ────────────────────────────────────
    section("Independent verification", 110);
    const qy = doc.y;
    doc.roundedRect(M, qy, 104, 104, 6).lineWidth(0.6).strokeColor(RULE).stroke();
    doc.image(qr, M + 6, qy + 6, { width: 92, height: 92 });
    const tx = M + 120;
    const tw = CW - 120;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text("Scan or visit to re-verify this record live", tx, qy, { width: tw });
    doc.font("Courier").fontSize(7.8).fillColor(PURPLE).text(record.urls.verify, tx, doc.y + 3, { width: tw, link: record.urls.verify });
    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(
      "Machine-readable check (JSON, no authentication required):", tx, doc.y + 6, { width: tw }
    );
    doc.font("Courier").fontSize(7.8).fillColor(PURPLE).text(record.urls.api, tx, doc.y + 2, { width: tw, link: record.urls.api });
    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(
      "This certificate is a dated snapshot of the verification performed when it was issued. The live page re-hashes the stored record and files on every visit and is authoritative.",
      tx, doc.y + 6, { width: tw, lineGap: 1 }
    );
    doc.y = Math.max(doc.y, qy + 104) + 10;

    doc.font("Helvetica").fontSize(7.6);
    const sealedList = `Sealed inputs: ${SEALED_FIELDS.join("; ")}.`;
    const disclaimer =
      `Verification depends on ${publisher}'s own records and archive storage; it is tamper-evident, not blockchain-anchored. When the platform itself updates a sealed field — assigning a DOI or regenerating the galleys — the record is resealed and the event is written to the audit log shown in the timeline above. Individually downloaded copies carry a per-reader provenance stamp and therefore have different file hashes from the archived galleys. This certificate attests authenticity only; it does not restrict reading, sharing or reuse — the work is licensed CC BY 4.0.`;
    ensure(doc.heightOfString(sealedList, { width: CW }) + doc.heightOfString(disclaimer, { width: CW }) + 16);
    doc.fillColor(MUTED).text(sealedList, M, doc.y, { width: CW, lineGap: 0.8 });
    doc.moveDown(0.5);
    doc.text(disclaimer, { width: CW, lineGap: 0.8 });

    // ── Per-page chrome: frame, watermark, footer ──────────────────────
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;

      // Double hairline frame.
      doc.save().lineWidth(0.7).strokeColor(GOLD).rect(16, 16, PAGE_W - 32, PAGE_H - 32).stroke();
      doc.lineWidth(0.3).strokeColor(GOLD).rect(20, 20, PAGE_W - 40, PAGE_H - 40).stroke().restore();

      // Diagonal watermark, centred on the page.
      doc.save();
      doc.rotate(-54, { origin: [PAGE_W / 2, PAGE_H / 2] });
      doc.font("Helvetica-Bold").fontSize(26).fillColor(PURPLE).fillOpacity(0.075);
      const wmW = doc.widthOfString(watermark, { characterSpacing: 1 });
      doc.text(watermark, PAGE_W / 2 - wmW / 2, PAGE_H / 2 - 14, { lineBreak: false, characterSpacing: 1 });
      doc.font("Helvetica").fontSize(9).fillOpacity(0.07);
      const subW = doc.widthOfString(record.sealReference, { characterSpacing: 3 });
      doc.text(record.sealReference, PAGE_W / 2 - subW / 2, PAGE_H / 2 + 20, { lineBreak: false, characterSpacing: 3 });
      doc.restore();

      // Footer.
      const fy = PAGE_H - 50;
      doc.moveTo(M, fy).lineTo(M + CW, fy).lineWidth(0.5).strokeColor(GOLD).stroke();
      doc.font("Helvetica-Bold").fontSize(6.6).fillColor(PURPLE)
        .text(`${publisher.toUpperCase()}  ·  ${record.sealReference}`, M, fy + 7, { characterSpacing: 0.8, lineBreak: false });
      doc.font("Helvetica").fontSize(6.8).fillColor(MUTED)
        .text(`Page ${i - range.start + 1} of ${range.count}`, M, fy + 7, { width: CW, align: "right", lineBreak: false });
      doc.font("Helvetica").fontSize(6.4).fillColor(MUTED)
        .text(`Issued ${fmtDate(record.checkedAt, true)}  ·  ${record.urls.verify}`, M, fy + 17, { width: credit ? CW - 180 : CW, lineBreak: false, ellipsis: true });
      if (credit) {
        doc.font("Helvetica").fontSize(6.4).fillColor(MUTED).text(credit, M, fy + 17, { width: CW, align: "right", lineBreak: false });
      }

      doc.page.margins.bottom = savedBottom;
    }

    doc.end();
  });
}

export function provenanceCertificateFileName(record: ProvenanceRecord): string {
  const base = (record.doi ?? record.id).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return `provenance-certificate-${base}.pdf`;
}
