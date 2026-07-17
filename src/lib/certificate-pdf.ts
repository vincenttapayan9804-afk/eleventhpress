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

const GOLD_LIGHT = "#fbf0cd";
const GOLD_MID = "#d4af5f";
const GOLD_DEEP = "#8a6a28";
const GOLD_SHADOW = "#5c4218";

/** One decorative tile: beveled square background + diamond outline + a
 * 4-petal quatrefoil motif — repeated edge-to-edge to build the frame. */
function drawOrnamentTile(doc: PDFKit.PDFDocument, x: number, y: number, size: number) {
  doc.save();
  doc.rect(x, y, size, size)
    .fill(doc.linearGradient(x, y, x + size, y + size).stop(0, GOLD_LIGHT).stop(0.5, GOLD_MID).stop(1, GOLD_DEEP));
  doc.lineWidth(0.5).strokeColor(GOLD_SHADOW).rect(x + 0.75, y + 0.75, size - 1.5, size - 1.5).stroke();

  const cx = x + size / 2, cy = y + size / 2, r = size * 0.36;
  doc.lineWidth(0.6).strokeColor(GOLD_SHADOW)
    .polygon([cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]).stroke();

  const pr = size * 0.15;
  doc.fillColor(GOLD_LIGHT);
  const petalOffset = r * 0.5;
  for (const [px, py] of [[cx, cy - petalOffset], [cx + petalOffset, cy], [cx, cy + petalOffset], [cx - petalOffset, cy]] as [number, number][]) {
    doc.ellipse(px, py, pr, pr * 0.62).fill();
  }
  doc.circle(cx, cy, size * 0.07).fillColor(GOLD_SHADOW).fill();
  doc.restore();
}

/**
 * A repeating-tile ornate gold frame: small beveled quatrefoil tiles run
 * edge-to-edge along all four sides with matching tiles anchoring each
 * corner — built natively (no stock clipart, so no licensing question).
 * Tile count per edge is chosen so tiles fit exactly with no partial tile
 * at the end. A slim purple accent rule sits just inside the tiled band.
 */
function drawGoldFrame(doc: PDFKit.PDFDocument, margin: number, frameWidth: number) {
  const { width, height } = doc.page;
  const oL = margin, oT = margin, oR = width - margin, oB = height - margin;
  const iL = margin + frameWidth, iT = margin + frameWidth, iR = width - margin - frameWidth, iB = height - margin - frameWidth;

  doc.save();

  drawOrnamentTile(doc, oL, oT, frameWidth);
  drawOrnamentTile(doc, oR - frameWidth, oT, frameWidth);
  drawOrnamentTile(doc, oL, oB - frameWidth, frameWidth);
  drawOrnamentTile(doc, oR - frameWidth, oB - frameWidth, frameWidth);

  const hRunLen = (oR - frameWidth) - (oL + frameWidth);
  const hCount = Math.max(1, Math.round(hRunLen / frameWidth));
  const hTileW = hRunLen / hCount;
  for (let i = 0; i < hCount; i++) {
    const tx = oL + frameWidth + i * hTileW;
    drawOrnamentTile(doc, tx, oT, hTileW);
    drawOrnamentTile(doc, tx, oB - frameWidth, hTileW);
  }

  const vRunLen = (oB - frameWidth) - (oT + frameWidth);
  const vCount = Math.max(1, Math.round(vRunLen / frameWidth));
  const vTileH = vRunLen / vCount;
  for (let i = 0; i < vCount; i++) {
    const ty = oT + frameWidth + i * vTileH;
    drawOrnamentTile(doc, oL, ty, frameWidth);
    drawOrnamentTile(doc, oR - frameWidth, ty, frameWidth);
  }

  doc.lineWidth(1).strokeColor(GOLD_SHADOW);
  doc.rect(oL, oT, oR - oL, oB - oT).stroke();
  doc.rect(iL, iT, iR - iL, iB - iT).stroke();

  doc.lineWidth(1.25).strokeColor(BRAND_PURPLE)
    .rect(iL + 6, iT + 6, (iR - iL) - 12, (iB - iT) - 12).stroke();

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

/**
 * One credibility group: category label centered on its own heading line,
 * its badges centered directly beneath (regular weight, smaller than the
 * label). Long lists (Syndication networks) get a narrower wrap column via
 * `itemsMaxWidth` so they reflow into a balanced multi-line block instead
 * of stretching far wider than every other group.
 */
function drawCenteredGroup(
  doc: PDFKit.PDFDocument,
  label: string,
  items: string[],
  x: number,
  y: number,
  width: number,
  labelColor: string,
  labelSize: number,
  itemSize: number,
  itemsMaxWidth?: number
): number {
  doc.font("Helvetica-Bold").fontSize(labelSize);
  const labelHeight = doc.heightOfString(label.toUpperCase(), { width });
  doc.fillColor(labelColor).text(label.toUpperCase(), x, y, { align: "center", width });
  const itemsY = y + labelHeight + 4;

  const iw = itemsMaxWidth ?? width;
  const ix = x + (width - iw) / 2;
  const itemsText = items.join(" · ");
  doc.fillColor(BRAND_INK).font("Helvetica").fontSize(itemSize)
    .text(itemsText, ix, itemsY, { align: "center", width: iw, lineGap: 2 });
  const itemsHeight = doc.heightOfString(itemsText, { width: iw, lineGap: 2 });

  return itemsY + itemsHeight;
}

/** All four honest credibility groups — reuses the exact same verified
 * indexing/benchmark/syndication/open-data lists already shown elsewhere
 * on the platform, never a new or inflated claim invented for the
 * certificate. Returns the y position immediately after the last group. */
function drawBadgeGroups(doc: PDFKit.PDFDocument, x: number, y: number, width: number, labelSize: number, itemSize: number, gap: number): number {
  let cy = y;
  cy = drawCenteredGroup(doc, "Indexed in", INDEXED_IN, x, cy, width, BRAND_GOLD, labelSize, itemSize) + gap;
  cy = drawCenteredGroup(doc, "Benchmarked standards", BENCHMARKED_STANDARDS, x, cy, width, BRAND_PURPLE, labelSize, itemSize) + gap;
  cy = drawCenteredGroup(doc, "Syndication networks", SYNDICATION_NETWORKS, x, cy, width, BRAND_GOLD, labelSize, itemSize, Math.min(width, 270)) + gap;
  cy = drawCenteredGroup(doc, "Open data sources", OPEN_DATA_SOURCES, x, cy, width, BRAND_PURPLE, labelSize, itemSize) + gap;
  return cy;
}

/** Just the syndication/open-data half of the four groups, for the
 * affiliation card — its "Indexed in"/"Benchmarked standards" groups are
 * drawn inside the card itself (see drawCardCredibilityGroup) so this
 * covers the remaining two below it without duplicating the first two. */
function drawRemainingBadgeGroups(doc: PDFKit.PDFDocument, x: number, y: number, width: number, labelSize: number, itemSize: number, gap: number): number {
  let cy = y;
  cy = drawCenteredGroup(doc, "Syndication networks", SYNDICATION_NETWORKS, x, cy, width, BRAND_GOLD, labelSize, itemSize, Math.min(width, 270)) + gap;
  cy = drawCenteredGroup(doc, "Open data sources", OPEN_DATA_SOURCES, x, cy, width, BRAND_PURPLE, labelSize, itemSize) + gap;
  return cy;
}

/** Left-aligned credibility group for inside the affiliation card itself —
 * matches the card's own left-aligned typographic style (brand/name/role/
 * serial are all left-aligned), unlike the centered groups used on the two
 * full-page certificate layouts. */
function drawCardCredibilityGroup(
  doc: PDFKit.PDFDocument,
  label: string,
  items: string[],
  x: number,
  y: number,
  width: number,
  labelColor: string,
  itemColor: string,
  labelSize: number,
  itemSize: number
): number {
  doc.fillColor(labelColor).font("Helvetica-Bold").fontSize(labelSize)
    .text(label.toUpperCase(), x, y, { width });
  const itemsY = y + labelSize + 3;

  const itemsText = items.join(" · ");
  doc.fillColor(itemColor).font("Helvetica").fontSize(itemSize)
    .text(itemsText, x, itemsY, { width, lineGap: 1.5 });
  const itemsHeight = doc.heightOfString(itemsText, { width, lineGap: 1.5 });

  return itemsY + itemsHeight;
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
  const frameMargin = 20;
  const frameWidth = 16;
  const margin = frameMargin + frameWidth + 6 + 14; // outer inset + gold band + purple rule gap + breathing room
  const contentWidth = doc.page.width - margin * 2 - 150;

  drawGoldFrame(doc, frameMargin, frameWidth);
  drawAvatarCircle(doc, avatarPng, margin + 46, 96, 30);

  doc.y = 50;
  doc.fillColor(BRAND_GOLD).font("Helvetica-Bold").fontSize(10)
    .text(payload.journalName.toUpperCase(), margin, doc.y, { align: "center", width: doc.page.width - margin * 2 });
  doc.moveDown(0.5);
  doc.fillColor(BRAND_PURPLE).font("Helvetica-Bold").fontSize(26)
    .text("Certificate of Recognition", margin, doc.y, { align: "center", width: doc.page.width - margin * 2 });
  doc.moveDown(0.55);
  doc.fillColor(BRAND_INK).font("Helvetica").fontSize(11)
    .text("This certificate is presented to", margin, doc.y, { align: "center", width: doc.page.width - margin * 2 });
  doc.moveDown(0.3);
  doc.fillColor(BRAND_PURPLE).font("Helvetica-Bold").fontSize(20)
    .text(payload.recipientName, margin, doc.y, { align: "center", width: doc.page.width - margin * 2 });
  doc.moveDown(0.35);
  doc.fillColor(BRAND_INK).font("Helvetica").fontSize(10)
    .text(recognitionBodyText(payload), (doc.page.width - contentWidth) / 2, doc.y, { align: "center", width: contentWidth });

  const blockX = margin + 44;
  const blockWidth = doc.page.width - blockX * 2;
  drawBadgeGroups(doc, blockX, doc.y + 18, blockWidth, 10, 8, 13);

  drawFooter(doc, margin, payload, qr);
  doc.end();
  return result;
}

export async function buildMembershipCertificate(payload: CertificatePayload, avatarPng: Buffer | null): Promise<Buffer> {
  const doc = newLandscapeDoc(`Certificate of Membership — ${payload.recipientName}`);
  const result = collect(doc);
  const qr = await buildVerifyQr(payload.serialNumber);
  const frameMargin = 20;
  const frameWidth = 16;
  const margin = frameMargin + frameWidth + 6 + 14;
  const contentWidth = doc.page.width - margin * 2 - 150;

  drawGoldFrame(doc, frameMargin, frameWidth);
  drawAvatarCircle(doc, avatarPng, margin + 46, 96, 30);

  doc.y = 50;
  doc.fillColor(BRAND_GOLD).font("Helvetica-Bold").fontSize(10)
    .text(payload.journalName.toUpperCase(), margin, doc.y, { align: "center", width: doc.page.width - margin * 2 });
  doc.moveDown(0.5);
  doc.fillColor(BRAND_PURPLE).font("Helvetica-Bold").fontSize(26)
    .text("Certificate of Membership", margin, doc.y, { align: "center", width: doc.page.width - margin * 2 });
  doc.moveDown(0.55);
  doc.fillColor(BRAND_INK).font("Helvetica").fontSize(11)
    .text("This certifies that", margin, doc.y, { align: "center", width: doc.page.width - margin * 2 });
  doc.moveDown(0.3);
  doc.fillColor(BRAND_PURPLE).font("Helvetica-Bold").fontSize(20)
    .text(payload.recipientName, margin, doc.y, { align: "center", width: doc.page.width - margin * 2 });
  doc.moveDown(0.35);
  doc.fillColor(BRAND_INK).font("Helvetica").fontSize(10)
    .text(`is a member in good standing of the ${MEMBERSHIP_BODY[payload.category]} of\n${payload.journalName}${payload.issn ? ` (ISSN ${payload.issn})` : ""}, effective the date below.`, (doc.page.width - contentWidth) / 2, doc.y, { align: "center", width: contentWidth });

  const blockX = margin + 44;
  const blockWidth = doc.page.width - blockX * 2;
  drawBadgeGroups(doc, blockX, doc.y + 18, blockWidth, 10, 8, 13);

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
  doc.restore();

  // The same globe image the home page hero uses (public/hero/hero-bg.png,
  // pre-cropped to the sphere — see certificate-globe-asset.ts), "cover"-fit
  // into the card's rounded interior so it fills edge-to-edge without
  // distortion, then a left-to-right purple vignette — the identical
  // blending technique the home page hero itself uses — keeps the text on
  // the left legible while the globe reads clearly on the right.
  doc.save();
  doc.roundedRect(cardX + 6, cardY + 6, cardW - 12, cardH - 12, 8).clip();
  doc.image(CARD_GLOBE_JPEG, cardX + 6, cardY + 6, { cover: [cardW - 12, cardH - 12], align: "center", valign: "center" });
  doc.rect(cardX + 6, cardY + 6, cardW - 12, cardH - 12).fill(
    doc.linearGradient(cardX + 6, cardY, cardX + cardW * 0.72, cardY)
      .stop(0, BRAND_PURPLE, 1)
      .stop(0.55, BRAND_PURPLE, 1)
      .stop(1, BRAND_PURPLE, 0)
  );
  doc.restore();
  doc.roundedRect(cardX + 6, cardY + 6, cardW - 12, cardH - 12, 8).lineWidth(1).strokeColor(BRAND_GOLD).stroke();

  // Top-left: brand + document label
  doc.fillColor(BRAND_GOLD).font("Helvetica-Bold").fontSize(8.5)
    .text("ELEVENTH PRESS INTERNATIONAL PUBLISHING", cardX + pad, cardY + 18, { width: cardW - pad * 2 - 76 });
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(10.5)
    .text("PROFESSIONAL AFFILIATION", cardX + pad, cardY + 32, { width: cardW - pad * 2 - 76 });

  // Top-right: avatar
  drawAvatarCircle(doc, avatarPng, cardX + cardW - pad - 28, cardY + 46, 28);

  // Mid-left: name + role — flow-positioned off the name's actual rendered
  // height (not a fixed offset) so a long name wrapping to two lines never
  // collides with the role line or the badges below it.
  const nameWidth = cardW - pad * 2 - 76;
  doc.font("Helvetica-Bold").fontSize(19);
  const nameHeight = doc.heightOfString(payload.recipientName, { width: nameWidth });
  doc.fillColor("#ffffff").text(payload.recipientName, cardX + pad, cardY + 100, { width: nameWidth });
  const roleY = cardY + 100 + nameHeight + 4;
  doc.font("Helvetica").fontSize(11.5);
  const roleHeight = doc.heightOfString(CARD_ROLE_LABEL[payload.category], { width: nameWidth });
  doc.fillColor(BRAND_GOLD).text(CARD_ROLE_LABEL[payload.category], cardX + pad, roleY, { width: nameWidth });

  // Indexed in / Benchmarked standards — inside the card itself, in the gap
  // between the role line and the bottom serial/QR row. Left-aligned to
  // match the card's own typographic style, in light tones that stay
  // legible against the purple/globe backdrop.
  const cardBadgeX = cardX + pad;
  const cardBadgeWidth = cardW - pad * 2 - 76;
  let cby = roleY + roleHeight + 8;
  cby = drawCardCredibilityGroup(doc, "Indexed in", INDEXED_IN, cardBadgeX, cby, cardBadgeWidth, BRAND_GOLD, "#f2ecff", 6.5, 5.5) + 4;
  drawCardCredibilityGroup(doc, "Benchmarked standards", BENCHMARKED_STANDARDS, cardBadgeX, cby, cardBadgeWidth, "#ffffff", "#f2ecff", 6.5, 5.5);

  // Bottom-left: serial/issued; bottom-right: QR
  doc.fillColor("#e8e0f5").font("Helvetica").fontSize(8)
    .text(`Serial ${payload.serialNumber}`, cardX + pad, cardY + cardH - 42, { width: cardW - pad * 2 - 76 });
  doc.text(`Issued ${new Date(payload.issuedAtIso).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })}`, cardX + pad, cardY + cardH - 30, { width: cardW - pad * 2 - 76 });
  doc.image(qr, cardX + cardW - pad - 56, cardY + cardH - 76, { width: 56, height: 56 });

  doc.fillColor(BRAND_MUTED).font("Helvetica").fontSize(8)
    .text(`Verify authenticity at ${APP_BASE_URL}/verify/${payload.serialNumber}`, 40, cardY + cardH + 22, { align: "center", width: doc.page.width - 80 });

  // Syndication networks / Open data sources — the remaining two
  // credibility groups, below the card (Indexed in/Benchmarked standards
  // already live inside it above, so this deliberately skips those two to
  // avoid printing them twice).
  const badgeX = 70;
  const badgeWidth = doc.page.width - badgeX * 2;
  drawRemainingBadgeGroups(doc, badgeX, cardY + cardH + 44, badgeWidth, 7.5, 6.5, 10);

  doc.end();
  return result;
}
