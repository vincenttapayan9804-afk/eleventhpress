/**
 * Certificate Verification Report — the downloadable PDF counterpart of
 * /verify/[serial], in the same design as the article "Certificate of
 * Digital Provenance" (src/lib/provenance-certificate-pdf.ts): purple/gold
 * cover band, seal emblem with the live verdict, checks, fingerprint,
 * record, timeline and a QR code back to the live page.
 *
 * It attests the verification result only. It is not the certificate
 * itself (that PDF stays private to its holder) and every page says so.
 */
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { CertificateRecord } from "@/lib/certificate-verification-record";
import { CERTIFICATE_SEALED_FIELDS } from "@/lib/certificate-verification-fields";
import {
  INK,
  MUTED,
  RULE,
  TINT,
  drawCheckGlyph,
  drawCrossGlyph,
  drawFingerprint,
  drawSeal,
  fmtDate,
  paletteFor,
  pdfSafe,
} from "@/lib/provenance-certificate-pdf";
import { POWERED_BY_CREDIT } from "@/lib/powered-by";

/** The issuing tenant's colours and logo (omit for the platform's own certificates). */
export interface VerificationReportBranding {
  brand?: { whitelabel: boolean; primaryHex?: string | null; accentHex?: string | null } | null;
  logoPng?: Buffer | null;
}

const PLATFORM_ISSUER = "Eleventh Press International Publishing™";
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 54;
const CW = PAGE_W - 2 * M;
const BOTTOM_LIMIT = PAGE_H - 78;

const STYLE = {
  verified: { fill: "#ecfdf5", stroke: "#34d399", ink: "#065f46", accent: "#059669", head: "VERIFIED — THIS CERTIFICATE IS AUTHENTIC" },
  mismatch: { fill: "#fef2f2", stroke: "#f87171", ink: "#991b1b", accent: "#dc2626", head: "VERIFICATION FAILED — HASH MISMATCH" },
} as const;

export async function buildCertificateVerificationPdf(record: CertificateRecord, branding: VerificationReportBranding = {}): Promise<Buffer> {
  const pal = paletteFor(branding.brand);
  const { purple: PURPLE, purpleDeep: PURPLE_DEEP, gold: GOLD, goldDeep: GOLD_DEEP } = pal;
  const credit = branding.brand?.whitelabel ? POWERED_BY_CREDIT : null;
  // The certificate's issuing publisher (a whitelabel tenant's institution,
  // or the platform) — named throughout the report instead of Eleventh Press.
  const issuer = pdfSafe(record.issuer || PLATFORM_ISSUER);
  const WATERMARK = `Verified at ${issuer}`;
  const qr = await QRCode.toBuffer(record.urls.verify, { errorCorrectionLevel: "M", margin: 1, width: 260, color: { dark: INK, light: "#ffffff" } });

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: M, bottom: 60, left: M, right: M },
      bufferPages: true,
      info: {
        Title: pdfSafe(`Certificate Verification Report — ${record.serialNumber}`),
        Author: issuer,
        Subject: pdfSafe(`${record.typeLabel} ${record.serialNumber} · ${record.verdict} · checked ${record.checkedAt}`),
        Keywords: pdfSafe(`certificate verification, SHA-256, ${record.serialNumber}`),
        Creator: `${issuer} — verification service`,
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const style = STYLE[record.verdict];
    let sectionNo = 0;
    const runningHeader = () => {
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor(GOLD_DEEP).text("CERTIFICATE VERIFICATION REPORT", M, 34, { characterSpacing: 1.6, lineBreak: false });
      doc.font("Courier").fontSize(7).fillColor(MUTED).text(record.serialNumber, M, 34, { width: CW, align: "right", lineBreak: false });
      doc.moveTo(M, 47).lineTo(M + CW, 47).lineWidth(0.5).strokeColor(RULE).stroke();
      doc.y = 64;
    };
    const ensure = (h: number) => {
      if (doc.y + h > BOTTOM_LIMIT) {
        doc.addPage();
        runningHeader();
      }
    };
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

    // Cover band
    doc.rect(0, 0, PAGE_W, 112).fill(doc.linearGradient(0, 0, PAGE_W, 112).stop(0, PURPLE_DEEP).stop(1, PURPLE));
    doc.rect(0, 112, PAGE_W, 2.2).fill(GOLD);
    let bx = M;
    if (branding.logoPng) {
      try {
        doc.save().roundedRect(M, 28, 56, 56, 6).fill("#ffffff").restore();
        doc.image(branding.logoPng, M + 4, 32, { fit: [48, 48], align: "center", valign: "center" });
        bx = M + 68;
      } catch {
        /* unreadable logo — the issuer name still identifies it */
      }
    }
    doc.font("Helvetica-Bold").fontSize(7.2).fillColor(GOLD).text(issuer.toUpperCase(), bx, 30, { characterSpacing: 2.2, lineBreak: false, width: CW - 150 - (bx - M), ellipsis: true });
    doc.font("Times-Bold").fontSize(bx > M ? 19 : 23).fillColor("#ffffff").text("Certificate Verification Report", bx, 46, { lineBreak: false });
    doc.font("Helvetica").fontSize(8.2).fillColor("#d9cff0").text("Cryptographic authenticity check of an issued certificate", bx, 76, { lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(6.3).fillColor(GOLD).text("SERIAL NUMBER", M, 30, { width: CW, align: "right", characterSpacing: 1.2, lineBreak: false });
    doc.font("Courier-Bold").fontSize(10).fillColor("#ffffff").text(record.serialNumber, M, 41, { width: CW, align: "right", lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(6.3).fillColor(GOLD).text("CHECKED", M, 60, { width: CW, align: "right", characterSpacing: 1.2, lineBreak: false });
    doc.font("Helvetica").fontSize(8.2).fillColor("#ffffff").text(fmtDate(record.checkedAt, true), M, 70, { width: CW, align: "right", lineBreak: false });

    // Verdict
    const vy = 134;
    const vh = 84;
    doc.roundedRect(M, vy, CW, vh, 8).fillAndStroke(style.fill, style.stroke);
    drawSeal(doc, M + 44, vy + vh / 2, 28, record.verdict, pal);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(style.ink).text(style.head, M + 88, vy + 16, { width: CW - 100, characterSpacing: 0.4 });
    doc.font("Helvetica").fontSize(8.6).fillColor(style.ink).text(
      record.verdict === "verified"
        ? "The SHA-256 content hash recomputed from the publisher's record of this certificate matches the hash printed on the certificate at the time this report was produced."
        : "The content hash recomputed from the publisher's record does not match the hash on file. Do not treat this certificate as valid.",
      M + 88, vy + 34, { width: CW - 104, lineGap: 1.2 }
    );

    // Certificate under verification
    doc.y = vy + vh + 22;
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor(PURPLE).text("CERTIFICATE UNDER VERIFICATION", M, doc.y, { characterSpacing: 1.6 });
    doc.moveDown(0.35);
    doc.font("Times-Bold").fontSize(15.5).fillColor(INK).text(pdfSafe(record.typeLabel), M, doc.y, { width: CW });
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(pdfSafe(`Issued to ${record.recipientName} · ${record.categoryLabel}`), { width: CW });
    doc.moveDown(0.15);
    doc.font("Times-Italic").fontSize(9.5).fillColor(MUTED).text(pdfSafe([record.issuer, record.issn ? `ISSN ${record.issn}` : null].filter(Boolean).join(" · ")), { width: CW });

    // 1. Checks
    section("Verification checks performed");
    const checks: { label: string; detail: string; ok: boolean }[] = [
      { label: "Certificate located", detail: `Serial ${record.serialNumber} is on the publisher's register of issued certificates.`, ok: true },
      { label: "Serial number well-formed", detail: "The serial follows the publisher's EP-<type>-<code> format.", ok: record.checks.serial },
      { label: "Record re-hashed", detail: "SHA-256 over the canonical, key-ordered JSON of every certified field equals the content hash on file.", ok: record.checks.payload },
    ];
    for (const c of checks) {
      doc.font("Helvetica").fontSize(8.2);
      const h = Math.max(26, doc.heightOfString(c.detail, { width: CW - 150 - 64 }) + 14);
      ensure(h);
      const y = doc.y;
      const color = c.ok ? "#059669" : "#dc2626";
      doc.circle(M + 8, y + 8, 7.5).fill(color);
      if (c.ok) drawCheckGlyph(doc, M + 8, y + 8, 6.5, "#ffffff");
      else drawCrossGlyph(doc, M + 8, y + 8, 6.5, "#ffffff");
      doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text(c.label, M + 24, y + 3, { width: 150 - 28 });
      doc.font("Helvetica").fontSize(8.2).fillColor(MUTED).text(c.detail, M + 150, y + 3, { width: CW - 150 - 64 });
      doc.font("Helvetica-Bold").fontSize(6.4).fillColor(color).text(c.ok ? "MATCH" : "MISMATCH", M, y + 4, { width: CW, align: "right", characterSpacing: 0.8, lineBreak: false });
      doc.y = y + h;
    }

    // 2. Fingerprint
    section("Cryptographic fingerprint");
    kvGrid([
      ["Algorithm", "SHA-256 (FIPS 180-4) over canonical, key-ordered JSON"],
      ["Issued", fmtDate(record.issuedAt, true)],
    ]);
    const hashBlock = (label: string, hash: string, fingerprint: boolean) => {
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
    hashBlock("Content hash on file (printed on the certificate)", record.contentHash, true);
    hashBlock("Recomputed now from the publisher's record", record.recomputedHash, false);

    // 3. Certificate record
    section("Certificate record");
    const rows: [string, string][] = [
      ["Document type", record.typeLabel],
      ["Capacity", record.categoryLabel],
      ["Issued to", record.recipientName],
      ["Issued", fmtDate(record.issuedAt)],
      ["Issuing publisher", record.issuer],
      ["ISSN", record.issn ?? "—"],
      ["Serial number", record.serialNumber],
      ["Status", record.verdict === "verified" ? "Authentic" : "Not authentic"],
    ];
    if (record.workTitle) rows.push(["Work cited", record.workTitle]);
    kvGrid(rows);

    // 4. Timeline
    section("Certificate timeline");
    record.timeline.forEach((e, i) => {
      doc.font("Helvetica").fontSize(8);
      const h = 16 + (e.detail ? doc.heightOfString(pdfSafe(e.detail), { width: CW - 150 }) : 0) + 6;
      ensure(h);
      const y = doc.y;
      const dotX = M + 118;
      if (i < record.timeline.length - 1) doc.moveTo(dotX, y + 9).lineTo(dotX, y + h + 2).lineWidth(0.8).strokeColor(RULE).stroke();
      doc.circle(dotX, y + 5, 3.6).fill(e.kind === "verified" ? style.accent : e.kind === "issued" ? GOLD_DEEP : PURPLE);
      doc.font("Helvetica").fontSize(7.8).fillColor(MUTED).text(fmtDate(e.at, true), M, y + 1, { width: 106, lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text(pdfSafe(e.label), M + 132, y, { width: CW - 132 });
      if (e.detail) doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(pdfSafe(e.detail), M + 132, doc.y + 1, { width: CW - 132 });
      doc.y = Math.max(doc.y, y + h - 6) + 6;
    });

    // 5. Independent verification
    section("Independent verification", 110);
    const qy = doc.y;
    doc.roundedRect(M, qy, 104, 104, 6).lineWidth(0.6).strokeColor(RULE).stroke();
    doc.image(qr, M + 6, qy + 6, { width: 92, height: 92 });
    const tx = M + 120;
    const tw = CW - 120;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text("Scan or visit to re-verify this certificate live", tx, qy, { width: tw });
    doc.font("Courier").fontSize(7.8).fillColor(PURPLE).text(record.urls.verify, tx, doc.y + 3, { width: tw, link: record.urls.verify });
    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text("Machine-readable check (JSON, no authentication required):", tx, doc.y + 6, { width: tw });
    doc.font("Courier").fontSize(7.8).fillColor(PURPLE).text(record.urls.api, tx, doc.y + 2, { width: tw, link: record.urls.api });
    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(
      "This report is a dated snapshot of the check performed when it was produced. The live page re-hashes the record on every visit and is authoritative.",
      tx, doc.y + 6, { width: tw, lineGap: 1 }
    );
    doc.y = Math.max(doc.y, qy + 104) + 10;

    doc.font("Helvetica").fontSize(7.6);
    const sealed = `Certified fields: ${CERTIFICATE_SEALED_FIELDS.join("; ")}.`;
    const disclaimer =
      `This report confirms the authenticity of the certificate identified above; it is not the certificate itself. Any alteration to a downloaded or printed certificate — a changed name, date, capacity or work title — will not match the content hash. Verification depends on ${issuer}'s own records; it is tamper-evident, not blockchain-anchored.`;
    ensure(doc.heightOfString(sealed, { width: CW }) + doc.heightOfString(disclaimer, { width: CW }) + 16);
    doc.fillColor(MUTED).text(sealed, M, doc.y, { width: CW, lineGap: 0.8 });
    doc.moveDown(0.5);
    doc.text(disclaimer, { width: CW, lineGap: 0.8 });

    // Per-page chrome
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.save().lineWidth(0.7).strokeColor(GOLD).rect(16, 16, PAGE_W - 32, PAGE_H - 32).stroke();
      doc.lineWidth(0.3).strokeColor(GOLD).rect(20, 20, PAGE_W - 40, PAGE_H - 40).stroke().restore();
      doc.save();
      doc.rotate(-54, { origin: [PAGE_W / 2, PAGE_H / 2] });
      doc.font("Helvetica-Bold").fontSize(26).fillColor(PURPLE).fillOpacity(0.075);
      const wmW = doc.widthOfString(WATERMARK, { characterSpacing: 1 });
      doc.text(WATERMARK, PAGE_W / 2 - wmW / 2, PAGE_H / 2 - 14, { lineBreak: false, characterSpacing: 1 });
      doc.font("Helvetica").fontSize(9).fillOpacity(0.07);
      const subW = doc.widthOfString(record.serialNumber, { characterSpacing: 3 });
      doc.text(record.serialNumber, PAGE_W / 2 - subW / 2, PAGE_H / 2 + 20, { lineBreak: false, characterSpacing: 3 });
      doc.restore();
      const fy = PAGE_H - 50;
      doc.moveTo(M, fy).lineTo(M + CW, fy).lineWidth(0.5).strokeColor(GOLD).stroke();
      doc.font("Helvetica-Bold").fontSize(6.6).fillColor(PURPLE).text(`${issuer.toUpperCase()}  ·  ${record.serialNumber}`, M, fy + 7, { characterSpacing: 0.8, lineBreak: false });
      doc.font("Helvetica").fontSize(6.8).fillColor(MUTED).text(`Page ${i - range.start + 1} of ${range.count}`, M, fy + 7, { width: CW, align: "right", lineBreak: false });
      doc.font("Helvetica").fontSize(6.4).fillColor(MUTED).text(`Checked ${fmtDate(record.checkedAt, true)}  ·  ${record.urls.verify}`, M, fy + 17, { width: credit ? CW - 180 : CW, lineBreak: false, ellipsis: true });
      if (credit) doc.font("Helvetica").fontSize(6.4).fillColor(MUTED).text(credit, M, fy + 17, { width: CW, align: "right", lineBreak: false });
      doc.page.margins.bottom = savedBottom;
    }
    doc.end();
  });
}

export function certificateVerificationFileName(record: CertificateRecord): string {
  return `certificate-verification-${record.serialNumber.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
}
