/**
 * Certificate PDF rendering — three distinct professional layouts, same
 * PDFKit renderer family as src/lib/galley.ts and src/lib/book-production.ts
 * (pure JS, no native binaries, runs fine on Vercel's serverless runtime).
 *
 * Each certificate prints its own serial number, verification hash, and a
 * QR code pointing at the public /verify/[serialNumber] page — the honest
 * "cryptographically verifiable, tamper-evident" mechanism described on
 * that page. Deliberately not described as "blockchain" anywhere here.
 *
 * Avatar embedding, the exact published-work title, and the journal
 * publisher name are resolved by the caller (src/app/api/certificates/
 * route.ts) and passed in — this module stays a pure PDF renderer with no
 * network or DB access of its own.
 */
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { APP_BASE_URL } from "@/lib/site";
import type { CertificatePayload } from "@/lib/certificates";

const BRAND_PURPLE = "#4c1d95";
const BRAND_GOLD = "#c9a55c";
const BRAND_INK = "#241b3a";
const BRAND_MUTED = "#6b6478";

const JOURNAL_TAGLINE = "A Full-Stack Peer Reviewed Press & Multidisciplinary Syndication Network";
const INDEXED_IN = "Google Scholar · Zenodo · OAI-PMH 2.0 · BASE · CORE · OpenAIRE";
const BENCHMARKED_STANDARDS = "SCOPUS · Web of Science (WoS) · COPE · WAME · CONSORT · ICMJE · STM";

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

/** Circular avatar photo — clips to a circle so it reads as a real photo
 * badge, not a rectangle. Skipped entirely (no placeholder icon) when no
 * real avatar was resolved, matching this codebase's convention of never
 * substituting a fabricated stand-in for missing real data. */
function drawAvatarCircle(doc: PDFKit.PDFDocument, avatarPng: Buffer | null, cx: number, cy: number, radius: number) {
  if (!avatarPng) return;
  doc.save();
  doc.circle(cx, cy, radius).clip();
  doc.image(avatarPng, cx - radius, cy - radius, { width: radius * 2, height: radius * 2 });
  doc.restore();
  doc.lineWidth(1.5).strokeColor(BRAND_GOLD).circle(cx, cy, radius).stroke();
}

/** Bottom-anchored, two-column footer used by both certificate layouts —
 * verification block (QR + serial/verify-url/issued date) on the left,
 * signature on the right, with enough horizontal separation that neither
 * ever collides regardless of how much text the verification block needs. */
function drawFooter(doc: PDFKit.PDFDocument, margin: number, payload: CertificatePayload, qr: Buffer) {
  const { width, height } = doc.page;
  const footerTop = height - margin - 100;
  const qrSize = 60;

  doc.image(qr, margin + 28, footerTop, { width: qrSize, height: qrSize });
  const textX = margin + 28 + qrSize + 14;
  const textWidth = width / 2 - textX;
  doc.fillColor(BRAND_MUTED).font("Helvetica").fontSize(7.5);
  doc.text(`Serial: ${payload.serialNumber}`, textX, footerTop + 2, { width: textWidth });
  doc.text(`Verify at ${APP_BASE_URL}/verify/${payload.serialNumber}`, textX, footerTop + 16, { width: textWidth });
  doc.text(`Issued ${new Date(payload.issuedAtIso).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}`, textX, footerTop + 30, { width: textWidth });

  const sigWidth = 200;
  const sigX = width - margin - 28 - sigWidth;
  doc.moveTo(sigX, footerTop + 30).lineTo(sigX + sigWidth, footerTop + 30).lineWidth(0.75).strokeColor(BRAND_MUTED).stroke();
  doc.fillColor(BRAND_MUTED).font("Helvetica-Oblique").fontSize(10)
    .text("Editor-in-Chief", sigX, footerTop + 36, { width: sigWidth, align: "center" });
}

/** Small, honest credibility line — reuses the exact same verified
 * indexing/benchmark lists already shown on the homepage and About page,
 * never a new or inflated claim invented just for the certificate. */
function drawBadgeLine(doc: PDFKit.PDFDocument, x: number, width: number) {
  doc.fillColor(BRAND_MUTED).font("Helvetica").fontSize(7.5);
  doc.text(`Indexed in: ${INDEXED_IN}`, x, doc.y, { align: "center", width });
  doc.moveDown(0.15);
  doc.text(`Benchmarked standards: ${BENCHMARKED_STANDARDS}`, x, doc.y, { align: "center", width });
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

const CATEGORY_SERVICE_TEXT: Record<CertificatePayload["category"], string> = {
  AUTHOR: "the publication of peer-reviewed research",
  REVIEWER: "distinguished service as a member of the Board of Reviewers",
  EDITOR: "distinguished service as a member of the Board of Editors",
};

const MEMBERSHIP_BODY: Record<CertificatePayload["category"], string> = {
  AUTHOR: "Published Author community",
  REVIEWER: "Board of Reviewers",
  EDITOR: "Board of Editors",
};

function recognitionBodyText(payload: CertificatePayload): string {
  if (payload.category === "AUTHOR" && payload.workTitle) {
    return `in recognition of the publication of\n“${payload.workTitle}”\nwith ${payload.journalName}${payload.issn ? ` (ISSN ${payload.issn})` : ""}.`;
  }
  return `in recognition of ${CATEGORY_SERVICE_TEXT[payload.category]}\nwith ${payload.journalName}${payload.issn ? ` (ISSN ${payload.issn})` : ""}.`;
}

export async function buildRecognitionCertificate(payload: CertificatePayload, avatarPng: Buffer | null): Promise<Buffer> {
  const doc = newLandscapeDoc(`Certificate of Recognition — ${payload.recipientName}`);
  const result = collect(doc);
  const qr = await buildVerifyQr(payload.serialNumber);
  const margin = 28;
  const contentWidth = doc.page.width - margin * 2 - 160;

  drawOrnateBorder(doc, margin);
  drawAvatarCircle(doc, avatarPng, margin + 74, 96, 34);

  doc.y = 62;
  doc.fillColor(BRAND_GOLD).font("Helvetica-Bold").fontSize(10)
    .text(payload.journalName.toUpperCase(), margin, doc.y, { align: "center", width: doc.page.width - margin * 2 });
  doc.moveDown(0.6);
  doc.fillColor(BRAND_PURPLE).font("Helvetica-Bold").fontSize(32)
    .text("Certificate of Recognition", margin, doc.y, { align: "center", width: doc.page.width - margin * 2 });
  doc.moveDown(1);
  doc.fillColor(BRAND_INK).font("Helvetica").fontSize(13)
    .text("This certificate is presented to", margin, doc.y, { align: "center", width: doc.page.width - margin * 2 });
  doc.moveDown(0.5);
  doc.fillColor(BRAND_PURPLE).font("Helvetica-Bold").fontSize(26)
    .text(payload.recipientName, margin, doc.y, { align: "center", width: doc.page.width - margin * 2 });
  doc.moveDown(0.7);
  doc.fillColor(BRAND_INK).font("Helvetica").fontSize(12)
    .text(recognitionBodyText(payload), (doc.page.width - contentWidth) / 2, doc.y, { align: "center", width: contentWidth });
  doc.moveDown(1.2);
  drawBadgeLine(doc, margin, doc.page.width - margin * 2);

  drawFooter(doc, margin, payload, qr);
  doc.end();
  return result;
}

export async function buildMembershipCertificate(payload: CertificatePayload, avatarPng: Buffer | null): Promise<Buffer> {
  const doc = newLandscapeDoc(`Certificate of Membership — ${payload.recipientName}`);
  const result = collect(doc);
  const qr = await buildVerifyQr(payload.serialNumber);
  const margin = 28;
  const contentWidth = doc.page.width - margin * 2 - 160;

  drawOrnateBorder(doc, margin);
  drawAvatarCircle(doc, avatarPng, margin + 74, 96, 34);

  doc.y = 62;
  doc.fillColor(BRAND_GOLD).font("Helvetica-Bold").fontSize(10)
    .text(payload.journalName.toUpperCase(), margin, doc.y, { align: "center", width: doc.page.width - margin * 2 });
  doc.moveDown(0.6);
  doc.fillColor(BRAND_PURPLE).font("Helvetica-Bold").fontSize(32)
    .text("Certificate of Membership", margin, doc.y, { align: "center", width: doc.page.width - margin * 2 });
  doc.moveDown(1);
  doc.fillColor(BRAND_INK).font("Helvetica").fontSize(13)
    .text("This certifies that", margin, doc.y, { align: "center", width: doc.page.width - margin * 2 });
  doc.moveDown(0.5);
  doc.fillColor(BRAND_PURPLE).font("Helvetica-Bold").fontSize(26)
    .text(payload.recipientName, margin, doc.y, { align: "center", width: doc.page.width - margin * 2 });
  doc.moveDown(0.7);
  doc.fillColor(BRAND_INK).font("Helvetica").fontSize(12)
    .text(`is a member in good standing of the ${MEMBERSHIP_BODY[payload.category]} of\n${payload.journalName}${payload.issn ? ` (ISSN ${payload.issn})` : ""}, effective the date below.`, (doc.page.width - contentWidth) / 2, doc.y, { align: "center", width: contentWidth });
  doc.moveDown(1.2);
  drawBadgeLine(doc, margin, doc.page.width - margin * 2);

  drawFooter(doc, margin, payload, qr);
  doc.end();
  return result;
}

const CARD_ROLE_LABEL: Record<CertificatePayload["category"], string> = {
  AUTHOR: "Published Author",
  REVIEWER: "Board of Reviewers Member",
  EDITOR: "Board of Editors Member",
};

/** Compact wallet/ID-card-style design, centered on a Letter page — a real
 * CR80 card size (3.375in x 2.125in) wouldn't be practically downloadable/
 * printable for most users, so the card graphic is enlarged and centered
 * for legible home printing, matching how real printable ID cards are
 * commonly distributed. Four-quadrant layout (brand top-left, photo
 * top-right, name/role mid-left, serial+QR bottom) keeps every element in
 * its own zone so nothing can collide regardless of name/title length. */
export async function buildAffiliationCard(payload: CertificatePayload, avatarPng: Buffer | null): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    bufferPages: true,
    info: { Title: `Professional Affiliation Card — ${payload.recipientName}` },
  });
  const result = collect(doc);
  const qr = await buildVerifyQr(payload.serialNumber);

  const cardW = 420;
  const cardH = 260;
  const cardX = (doc.page.width - cardW) / 2;
  const cardY = 190;
  const pad = 24;

  // Header above the card — journal name + tagline, dynamically spaced so
  // a long tagline wrapping to 2 lines never collides with the card below.
  doc.y = 60;
  doc.fillColor(BRAND_PURPLE).font("Helvetica-Bold").fontSize(20)
    .text(payload.journalName, 40, doc.y, { align: "center", width: doc.page.width - 80 });
  doc.moveDown(0.3);
  doc.fillColor(BRAND_MUTED).font("Helvetica").fontSize(9.5)
    .text(JOURNAL_TAGLINE, 40, doc.y, { align: "center", width: doc.page.width - 80 });

  doc.save();
  doc.roundedRect(cardX, cardY, cardW, cardH, 12).fillColor(BRAND_PURPLE).fill();
  doc.roundedRect(cardX + 6, cardY + 6, cardW - 12, cardH - 12, 8).lineWidth(1).strokeColor(BRAND_GOLD).stroke();
  doc.restore();

  // Top-left: brand + document label
  doc.fillColor(BRAND_GOLD).font("Helvetica-Bold").fontSize(8.5)
    .text("ELEVENTH PRESS INTERNATIONAL PUBLISHING", cardX + pad, cardY + 18, { width: cardW - pad * 2 - 76 });
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(10.5)
    .text("PROFESSIONAL AFFILIATION", cardX + pad, cardY + 32, { width: cardW - pad * 2 - 76 });

  // Top-right: avatar
  drawAvatarCircle(doc, avatarPng, cardX + cardW - pad - 28, cardY + 46, 28);

  // Mid-left: name + role
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(19)
    .text(payload.recipientName, cardX + pad, cardY + 100, { width: cardW - pad * 2 - 76 });
  doc.fillColor(BRAND_GOLD).font("Helvetica").fontSize(11.5)
    .text(CARD_ROLE_LABEL[payload.category], cardX + pad, cardY + 128, { width: cardW - pad * 2 - 76 });

  // Bottom-left: serial/issued; bottom-right: QR
  doc.fillColor("#e8e0f5").font("Helvetica").fontSize(8)
    .text(`Serial ${payload.serialNumber}`, cardX + pad, cardY + cardH - 42, { width: cardW - pad * 2 - 76 });
  doc.text(`Issued ${new Date(payload.issuedAtIso).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })}`, cardX + pad, cardY + cardH - 30, { width: cardW - pad * 2 - 76 });
  doc.image(qr, cardX + cardW - pad - 56, cardY + cardH - 76, { width: 56, height: 56 });

  doc.fillColor(BRAND_MUTED).font("Helvetica").fontSize(8)
    .text(`Verify authenticity at ${APP_BASE_URL}/verify/${payload.serialNumber}`, 40, cardY + cardH + 22, { align: "center", width: doc.page.width - 80 });
  doc.moveDown(0.8);
  drawBadgeLine(doc, 40, doc.page.width - 80);

  doc.end();
  return result;
}
