/**
 * Certificate PDF rendering — three distinct professional layouts, same
 * PDFKit renderer family as src/lib/galley.ts and src/lib/book-production.ts
 * (pure JS, no native binaries, runs fine on Vercel's serverless runtime).
 *
 * Each certificate prints its own serial number, verification hash, and a
 * QR code pointing at the public /verify/[serialNumber] page — the honest
 * "cryptographically verifiable, tamper-evident" mechanism described on
 * that page. Deliberately not described as "blockchain" anywhere here.
 */
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { APP_BASE_URL } from "@/lib/site";
import type { CertificatePayload } from "@/lib/certificates";

const BRAND_PURPLE = "#4c1d95";
const BRAND_GOLD = "#c9a55c";
const BRAND_INK = "#241b3a";
const BRAND_MUTED = "#6b6478";

async function buildVerifyQr(serialNumber: string): Promise<Buffer> {
  const url = `${APP_BASE_URL}/verify/${serialNumber}`;
  return QRCode.toBuffer(url, { errorCorrectionLevel: "M", margin: 1, width: 200, color: { dark: BRAND_INK, light: "#ffffff" } });
}

function drawOrnateBorder(doc: PDFKit.PDFDocument, margin: number) {
  const { width, height } = doc.page;
  doc.save();
  doc.lineWidth(2).strokeColor(BRAND_PURPLE)
    .rect(margin, margin, width - margin * 2, height - margin * 2).stroke();
  doc.lineWidth(0.75).strokeColor(BRAND_GOLD)
    .rect(margin + 8, margin + 8, width - (margin + 8) * 2, height - (margin + 8) * 2).stroke();
  doc.restore();
}

function drawFooter(doc: PDFKit.PDFDocument, margin: number, payload: CertificatePayload, qr: Buffer) {
  const { width, height } = doc.page;
  const qrSize = 64;
  const qrX = width - margin - 28 - qrSize;
  const qrY = height - margin - 28 - qrSize;
  doc.image(qr, qrX, qrY, { width: qrSize, height: qrSize });

  doc.fillColor(BRAND_MUTED).font("Helvetica").fontSize(7.5);
  doc.text(`Serial: ${payload.serialNumber}`, margin + 28, height - margin - 46, { width: width - margin * 2 - 140 });
  doc.text(`Verify at ${APP_BASE_URL}/verify/${payload.serialNumber}`, margin + 28, height - margin - 34, { width: width - margin * 2 - 140 });
  doc.text(`Issued ${new Date(payload.issuedAtIso).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}`, margin + 28, height - margin - 22, { width: width - margin * 2 - 140 });
}

function newLandscapeDoc(title: string): PDFKit.PDFDocument {
  return new PDFDocument({
    size: "A4",
    layout: "landscape",
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    bufferPages: true,
    info: { Title: title },
  });
}

function collect(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

const CATEGORY_TEXT: Record<CertificatePayload["category"], string> = {
  AUTHOR: "the publication of peer-reviewed research",
  REVIEWER: "distinguished service as a member of the Board of Reviewers",
  EDITOR: "distinguished service as a member of the Board of Editors",
};

const MEMBERSHIP_BODY: Record<CertificatePayload["category"], string> = {
  AUTHOR: "Published Author community",
  REVIEWER: "Board of Reviewers",
  EDITOR: "Board of Editors",
};

export async function buildRecognitionCertificate(payload: CertificatePayload): Promise<Buffer> {
  const doc = newLandscapeDoc(`Certificate of Recognition — ${payload.recipientName}`);
  const result = collect(doc);
  const qr = await buildVerifyQr(payload.serialNumber);
  const margin = 28;

  drawOrnateBorder(doc, margin);

  doc.fillColor(BRAND_GOLD).font("Helvetica-Bold").fontSize(10)
    .text(payload.journalName.toUpperCase(), 0, 70, { align: "center" });
  doc.fillColor(BRAND_PURPLE).font("Helvetica-Bold").fontSize(34)
    .text("Certificate of Recognition", 0, 100, { align: "center" });
  doc.moveDown(1.2);
  doc.fillColor(BRAND_INK).font("Helvetica").fontSize(13)
    .text("This certificate is presented to", { align: "center" });
  doc.moveDown(0.6);
  doc.fillColor(BRAND_PURPLE).font("Helvetica-Bold").fontSize(28)
    .text(payload.recipientName, { align: "center" });
  doc.moveDown(0.8);
  doc.fillColor(BRAND_INK).font("Helvetica").fontSize(12.5)
    .text(`in recognition of ${CATEGORY_TEXT[payload.category]}\nwith ${payload.journalName}${payload.issn ? ` (ISSN ${payload.issn})` : ""}.`, {
      align: "center",
      width: doc.page.width - margin * 2 - 160,
    });

  doc.fillColor(BRAND_MUTED).font("Helvetica-Oblique").fontSize(10)
    .text("Editor-in-Chief", doc.page.width - margin - 220, doc.page.height - margin - 90, { width: 180, align: "center" });
  doc.moveTo(doc.page.width - margin - 220, doc.page.height - margin - 96)
    .lineTo(doc.page.width - margin - 40, doc.page.height - margin - 96)
    .lineWidth(0.75).strokeColor(BRAND_MUTED).stroke();

  drawFooter(doc, margin, payload, qr);
  doc.end();
  return result;
}

export async function buildMembershipCertificate(payload: CertificatePayload): Promise<Buffer> {
  const doc = newLandscapeDoc(`Certificate of Membership — ${payload.recipientName}`);
  const result = collect(doc);
  const qr = await buildVerifyQr(payload.serialNumber);
  const margin = 28;

  drawOrnateBorder(doc, margin);

  doc.fillColor(BRAND_GOLD).font("Helvetica-Bold").fontSize(10)
    .text(payload.journalName.toUpperCase(), 0, 70, { align: "center" });
  doc.fillColor(BRAND_PURPLE).font("Helvetica-Bold").fontSize(34)
    .text("Certificate of Membership", 0, 100, { align: "center" });
  doc.moveDown(1.2);
  doc.fillColor(BRAND_INK).font("Helvetica").fontSize(13)
    .text("This certifies that", { align: "center" });
  doc.moveDown(0.6);
  doc.fillColor(BRAND_PURPLE).font("Helvetica-Bold").fontSize(28)
    .text(payload.recipientName, { align: "center" });
  doc.moveDown(0.8);
  doc.fillColor(BRAND_INK).font("Helvetica").fontSize(12.5)
    .text(`is a member in good standing of the ${MEMBERSHIP_BODY[payload.category]} of\n${payload.journalName}${payload.issn ? ` (ISSN ${payload.issn})` : ""}, effective the date below.`, {
      align: "center",
      width: doc.page.width - margin * 2 - 160,
    });

  doc.fillColor(BRAND_MUTED).font("Helvetica-Oblique").fontSize(10)
    .text("Editor-in-Chief", doc.page.width - margin - 220, doc.page.height - margin - 90, { width: 180, align: "center" });
  doc.moveTo(doc.page.width - margin - 220, doc.page.height - margin - 96)
    .lineTo(doc.page.width - margin - 40, doc.page.height - margin - 96)
    .lineWidth(0.75).strokeColor(BRAND_MUTED).stroke();

  drawFooter(doc, margin, payload, qr);
  doc.end();
  return result;
}

/** Compact wallet/ID-card-style design, centered on a Letter page — a real
 * CR80 card size (3.375in x 2.125in) wouldn't be practically downloadable/
 * printable for most users, so the card graphic is enlarged and centered
 * for legible home printing, matching how real printable ID cards are
 * commonly distributed. */
export async function buildAffiliationCard(payload: CertificatePayload): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    bufferPages: true,
    info: { Title: `Professional Affiliation Card — ${payload.recipientName}` },
  });
  const result = collect(doc);
  const qr = await buildVerifyQr(payload.serialNumber);

  const cardW = 380;
  const cardH = 230;
  const cardX = (doc.page.width - cardW) / 2;
  const cardY = 160;

  doc.save();
  doc.roundedRect(cardX, cardY, cardW, cardH, 12).fillColor(BRAND_PURPLE).fill();
  doc.roundedRect(cardX + 6, cardY + 6, cardW - 12, cardH - 12, 8).lineWidth(1).strokeColor(BRAND_GOLD).stroke();
  doc.restore();

  doc.fillColor(BRAND_GOLD).font("Helvetica-Bold").fontSize(9)
    .text(payload.journalName.toUpperCase(), cardX + 24, cardY + 24, { width: cardW - 48 });
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(11)
    .text("PROFESSIONAL AFFILIATION", cardX + 24, cardY + 40, { width: cardW - 48 });

  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(19)
    .text(payload.recipientName, cardX + 24, cardY + 78, { width: cardW - 120 });
  doc.fillColor(BRAND_GOLD).font("Helvetica").fontSize(11.5)
    .text(CERTIFICATE_CARD_ROLE[payload.category], cardX + 24, cardY + 104, { width: cardW - 120 });

  doc.fillColor("#e8e0f5").font("Helvetica").fontSize(8)
    .text(`Serial ${payload.serialNumber}`, cardX + 24, cardY + cardH - 40, { width: cardW - 120 });
  doc.text(`Issued ${new Date(payload.issuedAtIso).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })}`, cardX + 24, cardY + cardH - 28, { width: cardW - 120 });

  doc.image(qr, cardX + cardW - 88, cardY + cardH - 88, { width: 64, height: 64 });

  doc.fillColor(BRAND_PURPLE).font("Helvetica-Bold").fontSize(20)
    .text(payload.journalName, 0, cardY - 90, { align: "center" });
  doc.fillColor(BRAND_MUTED).font("Helvetica").fontSize(10)
    .text("Professional Affiliation Card", 0, cardY - 62, { align: "center" });

  doc.fillColor(BRAND_MUTED).font("Helvetica").fontSize(8.5)
    .text(`Verify authenticity at ${APP_BASE_URL}/verify/${payload.serialNumber}`, 0, cardY + cardH + 24, { align: "center" });

  doc.end();
  return result;
}

const CERTIFICATE_CARD_ROLE: Record<CertificatePayload["category"], string> = {
  AUTHOR: "Published Author",
  REVIEWER: "Board of Reviewers Member",
  EDITOR: "Board of Editors Member",
};
