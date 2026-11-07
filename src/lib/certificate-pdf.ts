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
import crypto from "crypto";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { APP_BASE_URL } from "@/lib/site";
import { canonicalCertificatePayload, type CertificatePayload } from "@/lib/certificates";
import { pdfSafe } from "@/lib/provenance-certificate-pdf";
import { CARD_GLOBE_JPEG_BASE64 } from "@/lib/certificate-globe-asset";

const CARD_GLOBE_JPEG = Buffer.from(CARD_GLOBE_JPEG_BASE64, "base64");

const BRAND_PURPLE = "#4c1d95";
const BRAND_GOLD = "#c9a55c";
const BRAND_INK = "#241b3a";
const BRAND_MUTED = "#6b6478";

const JOURNAL_TAGLINE = "A Full-Stack Peer Reviewed Press & Multidisciplinary Syndication Network";
const INDEXED_IN = ["Google Scholar", "Zenodo", "OAI-PMH 2.0", "BASE", "CORE", "OpenAIRE"];
const BENCHMARKED_STANDARDS = ["SCOPUS", "Web of Science (WoS)", "COPE", "WAME", "CONSORT", "ICMJE", "STM"];
const SYNDICATION_NETWORKS = [
  "Amazon KDP", "Apple Books", "Barnes & Noble", "IngramSpark", "Draft2Digital", "ResearchGate",
  "Academia.edu", "Substack", "Medium", "LinkedIn", "HubPages", "arXiv", "SSRN", "Blogger", "Lulu", "Kobo",
];
const OPEN_DATA_SOURCES = [
  "Crossref", "OpenAlex", "Semantic Scholar", "ERIC", "PubMed Central", "Zenodo", "CORE", "BASE", "OER Commons",
];

async function buildVerifyQr(serialNumber: string): Promise<Buffer> {
  const url = `${APP_BASE_URL}/verify/${serialNumber}`;
  return QRCode.toBuffer(url, { errorCorrectionLevel: "M", margin: 1, width: 200, color: { dark: BRAND_INK, light: "#ffffff" } });
}

// ── Design system shared with the article PDFs ─────────────────────────
// (src/lib/provenance-certificate-pdf.ts, data-table PDFs): purple
// gradient cover band over a gold rule, serif titles, a gold double
// hairline frame, a faint diagonal watermark and a running footer.
const PURPLE_DEEP = "#2a1458";
const GOLD_LIGHT = "#fbf0cd";
const GOLD_DEEP = "#8a6a28";
const RULE = "#e4dfee";
const TINT = "#f7f4fc";
const IVORY = "#fdfbf6";

const WATERMARK = "Eleventh Press International Publishing";

function contentHashOf(payload: CertificatePayload): string {
  return crypto.createHash("sha256").update(canonicalCertificatePayload(payload)).digest("hex");
}

function fmtIssued(payload: CertificatePayload, month: "long" | "short" = "long"): string {
  return new Date(payload.issuedAtIso).toLocaleDateString("en-GB", { year: "numeric", month, day: "numeric", timeZone: "UTC" });
}

function verifyUrl(payload: CertificatePayload): string {
  return `${APP_BASE_URL}/verify/${payload.serialNumber}`;
}

/** Largest font size (down to `min`) at which `text` fits on one line. */
function fitFontSize(doc: PDFKit.PDFDocument, text: string, font: string, max: number, min: number, width: number): number {
  doc.font(font);
  for (let size = max; size > min; size -= 0.5) {
    doc.fontSize(size);
    if (doc.widthOfString(text) <= width) return size;
  }
  return min;
}

/** A real avatar, clipped round with a double gold ring. Skipped (no
 * placeholder) when no avatar was resolved — never a fabricated stand-in. */
function drawAvatarCircle(doc: PDFKit.PDFDocument, avatarPng: Buffer | null, cx: number, cy: number, radius: number) {
  if (!avatarPng) return;
  doc.save().circle(cx, cy, radius + 3.5).fill(doc.linearGradient(cx - radius, cy - radius, cx + radius, cy + radius).stop(0, GOLD_LIGHT).stop(0.5, BRAND_GOLD).stop(1, GOLD_DEEP)).restore();
  doc.save();
  doc.circle(cx, cy, radius).clip();
  doc.image(avatarPng, cx - radius, cy - radius, { width: radius * 2, height: radius * 2 });
  doc.restore();
  doc.circle(cx, cy, radius).lineWidth(0.8).strokeColor("#ffffff").stroke();
}

/** Gold seal with notched edge and the "EP" monogram — the publisher's mark. */
function drawEmblem(doc: PDFKit.PDFDocument, cx: number, cy: number, r: number) {
  doc.save();
  doc.circle(cx, cy, r).fill(doc.radialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r).stop(0, GOLD_LIGHT).stop(0.6, BRAND_GOLD).stop(1, GOLD_DEEP));
  doc.lineWidth(0.6).strokeColor(GOLD_DEEP);
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    doc.moveTo(cx + Math.cos(a) * (r - 3.4), cy + Math.sin(a) * (r - 3.4)).lineTo(cx + Math.cos(a) * (r - 0.8), cy + Math.sin(a) * (r - 0.8)).stroke();
  }
  doc.circle(cx, cy, r * 0.74).lineWidth(0.7).strokeColor(GOLD_DEEP).stroke();
  doc.circle(cx, cy, r * 0.66).fill(PURPLE_DEEP);
  doc.circle(cx, cy, r * 0.66).lineWidth(0.8).strokeColor(GOLD_LIGHT).stroke();
  doc.restore();
  const mono = "EP";
  doc.font("Times-Bold").fontSize(r * 0.62).fillColor(GOLD_LIGHT);
  const w = doc.widthOfString(mono);
  doc.text(mono, cx - w / 2, cy - r * 0.36, { lineBreak: false });
}

/** Centered gold rule with a small diamond — the divider used under titles. */
function drawDivider(doc: PDFKit.PDFDocument, cx: number, y: number, half: number) {
  doc.save().lineWidth(0.7).strokeColor(BRAND_GOLD);
  doc.moveTo(cx - half, y).lineTo(cx - 8, y).stroke();
  doc.moveTo(cx + 8, y).lineTo(cx + half, y).stroke();
  doc.polygon([cx, y - 4], [cx + 4, y], [cx, y + 4], [cx - 4, y]).fill(BRAND_GOLD);
  doc.restore();
}

/** Faint diagonal watermark, as on every article PDF. */
function drawWatermark(doc: PDFKit.PDFDocument, text: string, angle: number, size: number, opacity: number) {
  const { width, height } = doc.page;
  doc.save();
  doc.rotate(angle, { origin: [width / 2, height / 2] });
  doc.font("Helvetica-Bold").fontSize(size).fillColor(BRAND_PURPLE).fillOpacity(opacity);
  const w = doc.widthOfString(text, { characterSpacing: 1 });
  doc.text(text, width / 2 - w / 2, height / 2 - size / 2, { lineBreak: false, characterSpacing: 1 });
  doc.restore();
}

/** Gold double hairline page frame with small diamond corner ornaments. */
function drawPageFrame(doc: PDFKit.PDFDocument) {
  const { width, height } = doc.page;
  doc.save().lineWidth(0.9).strokeColor(BRAND_GOLD).rect(14, 14, width - 28, height - 28).stroke();
  doc.lineWidth(0.35).strokeColor(BRAND_GOLD).rect(19, 19, width - 38, height - 38).stroke();
  for (const [x, y] of [[19, 19], [width - 19, 19], [19, height - 19], [width - 19, height - 19]]) {
    doc.polygon([x, y - 5], [x + 5, y], [x, y + 5], [x - 5, y]).fill(BRAND_GOLD);
  }
  doc.restore();
}

/** Purple gradient band over a gold rule, with the issuer on the left and
 * the serial / issue date on the right — the article PDFs' cover band. */
function drawCoverBand(doc: PDFKit.PDFDocument, payload: CertificatePayload, height: number, subtitle: string) {
  const { width } = doc.page;
  const m = 48;
  doc.rect(0, 0, width, height).fill(doc.linearGradient(0, 0, width, height).stop(0, PURPLE_DEEP).stop(1, BRAND_PURPLE));
  doc.rect(0, height, width, 2.2).fill(BRAND_GOLD);
  const leftW = width - 2 * m - 190;
  doc.font("Helvetica-Bold").fontSize(7.4).fillColor(BRAND_GOLD)
    .text(pdfSafe(payload.journalName).toUpperCase(), m, 30, { width: leftW, characterSpacing: 2.2, lineBreak: false });
  doc.font("Times-Bold").fontSize(16).fillColor("#ffffff").text(subtitle, m, 42, { width: leftW, lineBreak: false });
  doc.font("Helvetica").fontSize(7.8).fillColor("#d9cff0")
    .text(`${JOURNAL_TAGLINE}${payload.issn ? `  ·  ISSN ${payload.issn}` : ""}`, m, 63, { width: leftW, lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(6.3).fillColor(BRAND_GOLD).text("SERIAL NUMBER", m, 30, { width: width - 2 * m, align: "right", characterSpacing: 1.2, lineBreak: false });
  doc.font("Courier-Bold").fontSize(10).fillColor("#ffffff").text(payload.serialNumber, m, 40, { width: width - 2 * m, align: "right", lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(6.3).fillColor(BRAND_GOLD).text("ISSUED", m, 55, { width: width - 2 * m, align: "right", characterSpacing: 1.2, lineBreak: false });
  doc.font("Helvetica").fontSize(8.2).fillColor("#ffffff").text(fmtIssued(payload), m, 64, { width: width - 2 * m, align: "right", lineBreak: false });
}

/** The four credibility groups — the same verified lists shown elsewhere on
 * the platform, never a new claim — as columns in a tinted panel. */
const CREDENTIAL_GROUPS: { label: string; items: string[]; color: string }[] = [
  { label: "Indexed in", items: INDEXED_IN, color: GOLD_DEEP },
  { label: "Benchmarked standards", items: BENCHMARKED_STANDARDS, color: BRAND_PURPLE },
  { label: "Syndication networks", items: SYNDICATION_NETWORKS, color: GOLD_DEEP },
  { label: "Open data sources", items: OPEN_DATA_SOURCES, color: BRAND_PURPLE },
];

function credentialsPanelHeight(doc: PDFKit.PDFDocument, colW: number, itemSize: number): number {
  doc.font("Helvetica").fontSize(itemSize);
  return Math.max(...CREDENTIAL_GROUPS.map((g) => doc.heightOfString(g.items.join(" · "), { width: colW, lineGap: 1.6 }))) + 30;
}

function drawCredentialsPanel(doc: PDFKit.PDFDocument, x: number, y: number, width: number, itemSize = 7.2): number {
  const gap = 14;
  const colW = (width - 28 - gap * 3) / 4;
  const h = credentialsPanelHeight(doc, colW, itemSize);
  doc.roundedRect(x, y, width, h, 6).fillAndStroke(TINT, RULE);
  CREDENTIAL_GROUPS.forEach((g, i) => {
    const cx = x + 14 + i * (colW + gap);
    if (i > 0) doc.moveTo(cx - gap / 2, y + 12).lineTo(cx - gap / 2, y + h - 12).lineWidth(0.4).strokeColor(RULE).stroke();
    doc.font("Helvetica-Bold").fontSize(6.4).fillColor(g.color).text(g.label.toUpperCase(), cx, y + 11, { width: colW, align: "center", characterSpacing: 1, lineBreak: false });
    doc.font("Helvetica").fontSize(itemSize).fillColor(BRAND_INK).text(g.items.join(" · "), cx, y + 23, { width: colW, align: "center", lineGap: 1.6 });
  });
  return y + h;
}

function newLandscapeDoc(title: string, subject: string): PDFKit.PDFDocument {
  return new PDFDocument({
    size: "A4",
    layout: "landscape",
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    bufferPages: true,
    info: { Title: pdfSafe(title), Author: "Eleventh Press International Publishing", Subject: pdfSafe(subject), Creator: "Eleventh Press International Publishing — certificates" },
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
  EXPERT: "vetted admission to the Council of Experts",
};

const MEMBERSHIP_BODY: Record<CertificatePayload["category"], string> = {
  AUTHOR: "Published Author community",
  REVIEWER: "Board of Reviewers",
  EDITOR: "Board of Editors",
  EXPERT: "Council of Experts",
};

const CARD_ROLE_LABEL: Record<CertificatePayload["category"], string> = {
  AUTHOR: "Published Author",
  REVIEWER: "Board of Reviewers Member",
  EDITOR: "Board of Editors Member",
  EXPERT: "Council of Experts Member",
};

function issuerLine(payload: CertificatePayload): string {
  return `${payload.journalName}${payload.issn ? ` (ISSN ${payload.issn})` : ""}`;
}

interface FormalText {
  kicker: string;
  title: string;
  lead: string;
  body: string;
  work?: string | null;
}

/**
 * The formal certificate (Recognition and Membership), A4 landscape, in the
 * article-PDF design: cover band, serif title with a gold divider, the
 * recipient's name, the citation, the credibility panel, and a footer with
 * the QR code, serial and full SHA-256 content hash (left), the publisher's
 * seal (centre) and the Editor-in-Chief signature line (right).
 */
async function buildFormalCertificate(payload: CertificatePayload, avatarPng: Buffer | null, text: FormalText): Promise<Buffer> {
  const doc = newLandscapeDoc(`${text.title} — ${payload.recipientName}`, `${payload.serialNumber} · SHA-256 ${contentHashOf(payload)}`);
  const result = collect(doc);
  const qr = await buildVerifyQr(payload.serialNumber);
  const W = doc.page.width;
  const H = doc.page.height;
  const M = 48;
  const cx = W / 2;

  doc.rect(0, 0, W, H).fill(IVORY);
  drawWatermark(doc, WATERMARK, -24, 40, 0.035);
  drawCoverBand(doc, payload, 88, text.title);

  // Photo, top-left of the body.
  drawAvatarCircle(doc, avatarPng, M + 44, 150, 32);

  // Title block
  let y = 118;
  doc.font("Helvetica-Bold").fontSize(7.6).fillColor(GOLD_DEEP).text(text.kicker, 0, y, { width: W, align: "center", characterSpacing: 3, lineBreak: false });
  y += 14;
  doc.font("Times-Bold").fontSize(34).fillColor(BRAND_PURPLE).text(text.title, 0, y, { width: W, align: "center", lineBreak: false });
  y += 44;
  drawDivider(doc, cx, y, 120);
  y += 14;
  doc.font("Times-Italic").fontSize(12.5).fillColor(BRAND_MUTED).text(text.lead, 0, y, { width: W, align: "center", lineBreak: false });
  y += 20;
  const nameText = pdfSafe(payload.recipientName);
  const nameW = W - 2 * 150;
  const nameSize = fitFontSize(doc, nameText, "Times-Bold", 28, 15, nameW);
  doc.font("Times-Bold").fontSize(nameSize).fillColor(BRAND_INK).text(nameText, 150, y, { width: nameW, align: "center" });
  y = doc.y + 4;
  doc.moveTo(cx - 150, y).lineTo(cx + 150, y).lineWidth(0.6).strokeColor(BRAND_GOLD).stroke();
  y += 12;
  const bodyW = 560;
  doc.font("Times-Roman").fontSize(12).fillColor(BRAND_INK).text(pdfSafe(text.body), cx - bodyW / 2, y, { width: bodyW, align: "center", lineGap: 2 });
  if (text.work) {
    doc.font("Times-BoldItalic").fontSize(12.5).fillColor(BRAND_PURPLE).text(pdfSafe(`“${text.work}”`), cx - bodyW / 2, doc.y + 2, { width: bodyW, align: "center", lineGap: 2 });
  }
  doc.font("Times-Roman").fontSize(12).fillColor(BRAND_INK).text(pdfSafe(`with ${issuerLine(payload)}.`), cx - bodyW / 2, doc.y + 2, { width: bodyW, align: "center" });

  // Credibility panel
  const footerTop = H - 128;
  const panelX = M + 24;
  const panelW = W - 2 * panelX;
  // Centred in the space left between the citation and the footer.
  const panelH = credentialsPanelHeight(doc, (panelW - 28 - 42) / 4, 7.2);
  const free = footerTop - 14 - panelH - doc.y;
  const panelY = doc.y + Math.max(14, free / 2);
  drawCredentialsPanel(doc, panelX, panelY, panelW);

  // Footer: verification (left), seal (centre), signature (right)
  const qrSize = 66;
  const qx = M + 10;
  const qy = footerTop + 12;
  doc.roundedRect(qx - 4, qy - 4, qrSize + 8, qrSize + 8, 5).fillAndStroke("#ffffff", RULE);
  doc.image(qr, qx, qy, { width: qrSize, height: qrSize });
  const tx = qx + qrSize + 16;
  const tw = cx - 70 - tx;
  const hash = contentHashOf(payload);
  doc.font("Helvetica-Bold").fontSize(6.2).fillColor(BRAND_MUTED).text("SERIAL NUMBER", tx, qy - 2, { characterSpacing: 1, lineBreak: false });
  doc.font("Courier-Bold").fontSize(9).fillColor(BRAND_PURPLE).text(payload.serialNumber, tx, qy + 7, { lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(6.2).fillColor(BRAND_MUTED).text("CONTENT HASH (SHA-256)", tx, qy + 22, { characterSpacing: 1, lineBreak: false });
  doc.font("Courier").fontSize(6.6).fillColor(BRAND_INK).text(`${hash.slice(0, 32)}\n${hash.slice(32)}`, tx, qy + 31, { width: tw, lineGap: 0.5 });
  doc.font("Helvetica").fontSize(6.6).fillColor(BRAND_MUTED).text(`Scan or visit ${verifyUrl(payload)} to verify`, tx, qy + 52, { width: tw });

  drawEmblem(doc, cx, footerTop + 46, 36);

  const sigW = 200;
  const sx = W - M - 10 - sigW;
  doc.moveTo(sx, footerTop + 52).lineTo(sx + sigW, footerTop + 52).lineWidth(0.7).strokeColor(BRAND_INK).stroke();
  doc.font("Times-Italic").fontSize(11).fillColor(BRAND_INK).text("Editor-in-Chief", sx, footerTop + 57, { width: sigW, align: "center", lineBreak: false });
  doc.font("Helvetica").fontSize(7).fillColor(BRAND_MUTED).text(pdfSafe(payload.journalName), sx, footerTop + 72, { width: sigW, align: "center" });

  // Running footer line, as on the article PDFs
  const fy = H - 34;
  doc.moveTo(M, fy).lineTo(W - M, fy).lineWidth(0.5).strokeColor(BRAND_GOLD).stroke();
  doc.font("Helvetica-Bold").fontSize(6.4).fillColor(BRAND_PURPLE)
    .text(`${pdfSafe(payload.journalName).toUpperCase()}  ·  ${payload.serialNumber}`, M, fy + 5, { characterSpacing: 0.8, lineBreak: false });
  doc.font("Helvetica").fontSize(6.4).fillColor(BRAND_MUTED)
    .text(`Issued ${fmtIssued(payload)}  ·  Tamper-evident: any change to this document will not match the hash above`, M, fy + 5, { width: W - 2 * M, align: "right", lineBreak: false });

  drawPageFrame(doc);
  doc.end();
  return result;
}

export async function buildRecognitionCertificate(payload: CertificatePayload, avatarPng: Buffer | null): Promise<Buffer> {
  const isWork = payload.category === "AUTHOR" && !!payload.workTitle;
  return buildFormalCertificate(payload, avatarPng, {
    kicker: "IN RECOGNITION OF DISTINCTION",
    title: "Certificate of Recognition",
    lead: "This certificate is proudly presented to",
    body: isWork ? "in recognition of the publication of" : `in recognition of ${CATEGORY_SERVICE_TEXT[payload.category]}`,
    work: isWork ? payload.workTitle : null,
  });
}

export async function buildMembershipCertificate(payload: CertificatePayload, avatarPng: Buffer | null): Promise<Buffer> {
  return buildFormalCertificate(payload, avatarPng, {
    kicker: "IN GOOD STANDING",
    title: "Certificate of Membership",
    lead: "This certifies that",
    body: `is a member in good standing of the ${MEMBERSHIP_BODY[payload.category]}, effective ${fmtIssued(payload)},`,
  });
}

// ── Professional Affiliation Card ──────────────────────────────────────
// CR80 ID-card proportions (85.6 × 54 mm), enlarged 1.6× so it prints
// legibly at home. Both sides are laid out on one Letter page with real,
// visible card edges: a soft drop shadow, a hairline outline and crop marks
// at every corner, so it can be cut out (or printed double-sided).
const CARD_W = 396;
const CARD_H = 250;
const CARD_R = 14;

function drawCardShell(doc: PDFKit.PDFDocument, x: number, y: number) {
  // Soft shadow
  for (const [dy, op, grow] of [[6, 0.05, 3], [4, 0.06, 1.5], [2, 0.08, 0.5]] as const) {
    doc.save().fillOpacity(op).roundedRect(x - grow, y + dy - grow, CARD_W + grow * 2, CARD_H + grow * 2, CARD_R + grow).fill("#1b1030").restore();
  }
  // Crop marks
  doc.save().lineWidth(0.5).strokeColor("#9a92ab");
  const marks: [number, number, number, number][] = [
    [x, y, -1, -1], [x + CARD_W, y, 1, -1], [x, y + CARD_H, -1, 1], [x + CARD_W, y + CARD_H, 1, 1],
  ];
  for (const [mx, my, sx, sy] of marks) {
    doc.moveTo(mx + sx * 6, my).lineTo(mx + sx * 18, my).stroke();
    doc.moveTo(mx, my + sy * 6).lineTo(mx, my + sy * 18).stroke();
  }
  doc.restore();
}

function drawCardEdge(doc: PDFKit.PDFDocument, x: number, y: number) {
  doc.roundedRect(x, y, CARD_W, CARD_H, CARD_R).lineWidth(0.9).strokeColor("#b9b0cc").stroke();
}

function drawChip(doc: PDFKit.PDFDocument, x: number, y: number) {
  const w = 36;
  const h = 27;
  doc.save();
  doc.roundedRect(x, y, w, h, 5).fill(doc.linearGradient(x, y, x + w, y + h).stop(0, GOLD_LIGHT).stop(0.5, BRAND_GOLD).stop(1, GOLD_DEEP));
  doc.lineWidth(0.6).strokeColor(GOLD_DEEP);
  doc.roundedRect(x + 11, y + 7, 14, 13, 2).stroke();
  doc.moveTo(x, y + 9).lineTo(x + 11, y + 9).moveTo(x, y + 18).lineTo(x + 11, y + 18).stroke();
  doc.moveTo(x + 25, y + 9).lineTo(x + w, y + 9).moveTo(x + 25, y + 18).lineTo(x + w, y + 18).stroke();
  doc.moveTo(x + w / 2, y).lineTo(x + w / 2, y + 7).moveTo(x + w / 2, y + 20).lineTo(x + w / 2, y + h).stroke();
  doc.restore();
}

function cardLabel(doc: PDFKit.PDFDocument, text: string, x: number, y: number, color: string, width?: number) {
  doc.font("Helvetica-Bold").fontSize(5.6).fillColor(color).text(text, x, y, { characterSpacing: 1.1, lineBreak: false, ...(width ? { width } : {}) });
}

function drawCardFront(doc: PDFKit.PDFDocument, payload: CertificatePayload, avatarPng: Buffer | null, qr: Buffer, x: number, y: number) {
  drawCardShell(doc, x, y);
  doc.save();
  doc.roundedRect(x, y, CARD_W, CARD_H, CARD_R).clip();
  doc.rect(x, y, CARD_W, CARD_H).fill(doc.linearGradient(x, y, x + CARD_W, y + CARD_H).stop(0, PURPLE_DEEP).stop(1, BRAND_PURPLE));
  // The home page hero's globe, "cover"-fit on the right, blended into the
  // purple with a left-to-right vignette so the text stays legible.
  doc.image(CARD_GLOBE_JPEG, x + CARD_W * 0.3, y, { cover: [CARD_W * 0.7, CARD_H], align: "center", valign: "center" });
  doc.rect(x, y, CARD_W, CARD_H).fill(
    doc.linearGradient(x, y, x + CARD_W, y).stop(0, PURPLE_DEEP, 1).stop(0.42, PURPLE_DEEP, 0.96).stop(0.78, BRAND_PURPLE, 0.35).stop(1, BRAND_PURPLE, 0.15)
  );
  // Gold top rule, like the article PDFs' cover band
  doc.rect(x, y + 50, CARD_W, 1.2).fill(BRAND_GOLD);
  doc.restore();
  doc.roundedRect(x + 6, y + 6, CARD_W - 12, CARD_H - 12, CARD_R - 5).lineWidth(0.6).strokeColor(BRAND_GOLD).stroke();

  const pad = 22;
  cardLabel(doc, pdfSafe(payload.journalName).toUpperCase(), x + pad, y + 18, BRAND_GOLD, CARD_W - pad * 2 - 90);
  doc.font("Times-Bold").fontSize(12.5).fillColor("#ffffff").text("Professional Affiliation Card", x + pad, y + 28, { lineBreak: false });

  drawChip(doc, x + pad, y + 66);

  // Photo, top-right
  drawAvatarCircle(doc, avatarPng, x + CARD_W - pad - 34, y + 92, 34);

  // Name + role
  const nameW = CARD_W - pad * 2 - 84;
  const name = pdfSafe(payload.recipientName).toUpperCase();
  const size = fitFontSize(doc, name, "Helvetica-Bold", 17, 10, nameW);
  doc.font("Helvetica-Bold").fontSize(size).fillColor("#ffffff").text(name, x + pad, y + 106, { width: nameW });
  const roleY = Math.max(doc.y + 2, y + 128);
  doc.font("Times-Italic").fontSize(11).fillColor(BRAND_GOLD).text(CARD_ROLE_LABEL[payload.category], x + pad, roleY, { width: nameW, lineBreak: false });

  // Bottom row: serial / issued / ISSN, QR at right
  const by = y + CARD_H - 44;
  const cols: [string, string][] = [
    ["SERIAL NO.", payload.serialNumber],
    ["ISSUED", fmtIssued(payload, "short")],
    ["ISSN", payload.issn ?? "—"],
  ];
  let cxp = x + pad;
  cols.forEach(([k, v], i) => {
    cardLabel(doc, k, cxp, by, "#cbbcf0");
    doc.font(i === 0 ? "Courier-Bold" : "Helvetica-Bold").fontSize(i === 0 ? 8 : 8.2).fillColor("#ffffff").text(v, cxp, by + 9, { lineBreak: false });
    cxp += i === 0 ? 118 : 74;
  });
  const qs = 56;
  doc.roundedRect(x + CARD_W - pad - qs - 3, y + CARD_H - pad - qs - 3, qs + 6, qs + 6, 4).fill("#ffffff");
  doc.image(qr, x + CARD_W - pad - qs, y + CARD_H - pad - qs, { width: qs, height: qs });

  drawCardEdge(doc, x, y);
}

function drawCardBack(doc: PDFKit.PDFDocument, payload: CertificatePayload, qr: Buffer, x: number, y: number) {
  drawCardShell(doc, x, y);
  doc.save();
  doc.roundedRect(x, y, CARD_W, CARD_H, CARD_R).clip();
  doc.rect(x, y, CARD_W, CARD_H).fill(IVORY);
  // Faint guilloche-style rings, a classic anti-counterfeit card pattern
  doc.lineWidth(0.35).strokeColor(BRAND_PURPLE).strokeOpacity(0.07);
  for (let i = 0; i < 16; i++) doc.circle(x + CARD_W * 0.78, y + CARD_H * 0.62, 18 + i * 9).stroke();
  doc.strokeOpacity(1);
  // Stripe, purple with a gold rule
  doc.rect(x, y + 18, CARD_W, 30).fill(doc.linearGradient(x, y, x + CARD_W, y).stop(0, PURPLE_DEEP).stop(1, BRAND_PURPLE));
  doc.rect(x, y + 48, CARD_W, 1.2).fill(BRAND_GOLD);
  doc.restore();
  doc.font("Helvetica-Bold").fontSize(6.2).fillColor(BRAND_GOLD).text("VERIFIED PROFESSIONAL AFFILIATION", x + 22, y + 25, { characterSpacing: 1.6, lineBreak: false });
  doc.font("Courier-Bold").fontSize(8).fillColor("#ffffff").text(payload.serialNumber, x + 22, y + 34, { lineBreak: false });

  const pad = 22;
  const qs = 64;
  const qx = x + CARD_W - pad - qs;
  const leftW = CARD_W - pad * 2 - qs - 16;

  // Statement
  doc.font("Times-Bold").fontSize(9.6).fillColor(BRAND_PURPLE).text(pdfSafe(payload.journalName), x + pad, y + 58, { width: leftW, lineBreak: false });
  doc.font("Helvetica").fontSize(7.2).fillColor(BRAND_INK).text(
    pdfSafe(`This card certifies the holder's professional affiliation with ${issuerLine(payload)} as ${CARD_ROLE_LABEL[payload.category]}. Scan the QR code to check its authenticity at any time.`),
    x + pad, y + 71, { width: leftW, lineGap: 1 }
  );

  // Credentials, 2 × 2
  const gy = doc.y + 9;
  const colW = (leftW - 10) / 2;
  const groupH = (g: (typeof CREDENTIAL_GROUPS)[number]) => {
    doc.font("Helvetica").fontSize(5.9);
    return 9 + doc.heightOfString(g.items.join(" · "), { width: colW, lineGap: 0.8 });
  };
  const row1 = Math.max(groupH(CREDENTIAL_GROUPS[0]), groupH(CREDENTIAL_GROUPS[1]));
  CREDENTIAL_GROUPS.forEach((g, i) => {
    const gx = x + pad + (i % 2) * (colW + 10);
    const gyy = gy + (i < 2 ? 0 : row1 + 7);
    cardLabel(doc, g.label.toUpperCase(), gx, gyy, g.color);
    doc.font("Helvetica").fontSize(5.9).fillColor(BRAND_INK).text(g.items.join(" · "), gx, gyy + 8, { width: colW, lineGap: 0.8 });
  });

  // QR + verification, right
  doc.roundedRect(qx - 4, y + 60, qs + 8, qs + 8, 5).fillAndStroke("#ffffff", RULE);
  doc.image(qr, qx, y + 64, { width: qs, height: qs });
  cardLabel(doc, "SCAN TO VERIFY", qx - 4, y + 60 + qs + 13, BRAND_PURPLE, qs + 8);
  const hash = contentHashOf(payload);
  doc.font("Courier").fontSize(5.2).fillColor(BRAND_MUTED).text(`SHA-256\n${hash.slice(0, 16)}\n${hash.slice(16, 32)}\n${hash.slice(32, 48)}\n${hash.slice(48)}`, qx - 4, y + 60 + qs + 23, { width: qs + 8, align: "center", lineGap: 0.2 });

  // Signature strip
  const sy = y + CARD_H - 40;
  const sw = leftW;
  doc.save();
  doc.rect(x + pad, sy, sw, 16).fill("#ffffff");
  doc.rect(x + pad, sy, sw, 16).clip();
  doc.lineWidth(0.3).strokeColor(BRAND_PURPLE).strokeOpacity(0.18);
  for (let i = -16; i < sw; i += 5) doc.moveTo(x + pad + i, sy + 16).lineTo(x + pad + i + 16, sy).stroke();
  doc.restore();
  doc.rect(x + pad, sy, sw, 16).lineWidth(0.5).strokeColor(RULE).stroke();
  doc.font("Helvetica").fontSize(5.6).fillColor(BRAND_MUTED).text("Holder's signature", x + pad, sy + 19, { lineBreak: false });
  doc.text(`Issued ${fmtIssued(payload, "short")}`, x + pad, sy + 19, { width: sw, align: "right", lineBreak: false });

  drawCardEdge(doc, x, y);
}

export async function buildAffiliationCard(payload: CertificatePayload, avatarPng: Buffer | null): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    bufferPages: true,
    info: {
      Title: pdfSafe(`Professional Affiliation Card — ${payload.recipientName}`),
      Author: "Eleventh Press International Publishing",
      Subject: pdfSafe(`${payload.serialNumber} · SHA-256 ${contentHashOf(payload)}`),
      Creator: "Eleventh Press International Publishing — certificates",
    },
  });
  const result = collect(doc);
  const qr = await buildVerifyQr(payload.serialNumber);
  const W = doc.page.width;
  const H = doc.page.height;
  const M = 48;

  doc.rect(0, 0, W, H).fill("#ffffff");
  drawWatermark(doc, WATERMARK, -54, 26, 0.04);
  drawCoverBand(doc, payload, 88, "Professional Affiliation Card");

  doc.font("Helvetica").fontSize(8).fillColor(BRAND_MUTED)
    .text("Front and back of your card. Print at actual size (100%) and cut along the card edges, or print the two sides double-sided.", M, 102, { width: W - 2 * M, align: "center" });

  const x = (W - CARD_W) / 2;
  const frontY = 146;
  const backY = frontY + CARD_H + 56;
  doc.font("Helvetica-Bold").fontSize(6.6).fillColor(GOLD_DEEP).text("FRONT", x + 26, frontY - 14, { characterSpacing: 2, lineBreak: false });
  drawCardFront(doc, payload, avatarPng, qr, x, frontY);
  doc.font("Helvetica-Bold").fontSize(6.6).fillColor(GOLD_DEEP).text("BACK", x + 26, backY - 14, { characterSpacing: 2, lineBreak: false });
  drawCardBack(doc, payload, qr, x, backY);

  const fy = H - 46;
  doc.font("Helvetica").fontSize(7.6).fillColor(BRAND_MUTED)
    .text(`Verify authenticity at ${verifyUrl(payload)}`, M, backY + CARD_H + 24, { width: W - 2 * M, align: "center" });
  doc.moveTo(M, fy).lineTo(W - M, fy).lineWidth(0.5).strokeColor(BRAND_GOLD).stroke();
  doc.font("Helvetica-Bold").fontSize(6.4).fillColor(BRAND_PURPLE)
    .text(`${pdfSafe(payload.journalName).toUpperCase()}  ·  ${payload.serialNumber}`, M, fy + 6, { characterSpacing: 0.8, lineBreak: false });
  doc.font("Helvetica").fontSize(6.4).fillColor(BRAND_MUTED)
    .text(`Issued ${fmtIssued(payload)}`, M, fy + 6, { width: W - 2 * M, align: "right", lineBreak: false });

  drawPageFrame(doc);
  doc.end();
  return result;
}
