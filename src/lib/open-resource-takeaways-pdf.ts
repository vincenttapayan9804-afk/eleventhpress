/**
 * PDF edition of the Eleventh Press Editorial Takeaways for an Open
 * Resources title (/resources/open-resources/[slug]/takeaways/pdf).
 *
 * House style is the same as the official guide PDFs (src/lib/guide-pdf.ts):
 * the same PDFKit renderer, standard fonts, purple/gold palette, masthead band
 * with seal motif, double gold hairline frame, faint diagonal watermark,
 * running header and footer. That keeps every Eleventh Press document looking
 * like part of one family.
 *
 * Licence care (see src/lib/open-resources-takeaways.ts):
 * - no images from the publication: its covers and photos are excluded from
 *   its open licence, so the cover is typographic only;
 * - the no-endorsement notice is printed prominently before the takeaways;
 * - the original is fully credited (rights holder, licence, link, citation),
 *   and the QR code points readers to the original publication.
 */
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { ISSN_PENDING_LABEL, JOURNAL_IDENTITY } from "@/lib/site";
import { pdfSafe } from "@/lib/provenance-certificate-pdf";
import type { OpenResource } from "@/lib/open-resources";
import { isNonCommercial, termsFor } from "@/lib/open-resources";
import {
  TAKEAWAYS_AUTHOR, TAKEAWAYS_NOTICE, TAKEAWAYS_ONLINE_PATH, takeawaysCitation, type EditorialTakeaways,
} from "@/lib/open-resources-takeaways";
import { PLATFORM_RESOURCE_BRAND } from "@/lib/resources/tenant-brand";

const PURPLE = PLATFORM_RESOURCE_BRAND.primaryHex;
const PURPLE_DEEP = "#2a1458";
const GOLD = PLATFORM_RESOURCE_BRAND.accentHex;
const GOLD_DEEP = "#8a6a28";
const INK = "#241b3a";
const BODY = "#2e2742";
const MUTED = "#6b6478";
const RULE = "#e4dfee";
const TINT = "#f7f4fc";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 58;
const CW = PAGE_W - 2 * M;
const TOP = 74;
const BOTTOM_MARGIN = 76;
const BOTTOM_LIMIT = PAGE_H - BOTTOM_MARGIN;

const fmtLong = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function takeawaysPdfFileName(r: OpenResource, t: EditorialTakeaways): string {
  const slug = r.slug.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  return `eleventh-press-${t.code.toLowerCase()}-takeaways-${slug}.pdf`;
}

/** The original publication's own link: its DOI when it has one, else the repository page. */
export function originalUrl(r: OpenResource): string {
  return r.doi ? `https://doi.org/${r.doi}` : r.sourceUrl;
}

/**
 * The branded PDF of a title's takeaways. Always issued under Eleventh
 * Press's own identity: it is Eleventh Press's commentary, so it is never
 * re-branded for a tenant site (the route serves the platform only).
 */
export async function buildTakeawaysPdf(r: OpenResource, tk: EditorialTakeaways): Promise<Buffer> {
  const brand = PLATFORM_RESOURCE_BRAND;
  const BASE = brand.baseUrl;
  const J = { name: JOURNAL_IDENTITY.name, tagline: JOURNAL_IDENTITY.tagline };
  const host = BASE.replace(/^https?:\/\//, "");
  const issnLine = brand.issn ? `ISSN ${brand.issn} (Online)` : ISSN_PENDING_LABEL;
  const contactLine = [issnLine, brand.location, brand.email, host].filter(Boolean).join("  ·  ");
  const source = originalUrl(r);
  const qr = await QRCode.toBuffer(source, { errorCorrectionLevel: "M", margin: 1, width: 240, color: { dark: INK, light: "#ffffff" } });
  const fullTitle = r.subtitle ? `${r.title}: ${r.subtitle}` : r.title;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: TOP, bottom: BOTTOM_MARGIN, left: M, right: M },
      bufferPages: true,
      info: {
        Title: pdfSafe(`Editorial Takeaways: ${fullTitle} (${tk.code})`),
        Author: pdfSafe(J.name),
        Subject: pdfSafe(`Eleventh Press's independent editorial takeaways on ${fullTitle}, published by ${r.publisher}.`),
        Keywords: pdfSafe([r.category, r.type, "open access", "editorial takeaways", r.licence.code].join(", ")),
        Creator: pdfSafe(TAKEAWAYS_AUTHOR),
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const t = (s: string) => pdfSafe(s);
    const newPage = () => {
      doc.addPage();
      doc.x = M;
      doc.y = TOP;
    };
    const ensure = (h: number) => {
      if (doc.y + h > BOTTOM_LIMIT) newPage();
    };
    const bodyFont = () => doc.font("Times-Roman").fontSize(10.6).fillColor(BODY);
    const paragraph = (text: string, gapAfter = 7, align: "justify" | "left" = "justify") => {
      bodyFont();
      ensure(Math.min(doc.heightOfString(t(text), { width: CW, lineGap: 2.4 }), 40));
      doc.text(t(text), M, doc.y, { width: CW, align, lineGap: 2.4 });
      doc.y += gapAfter;
    };
    let sectionNo = 0;
    const heading = (title: string, numbered = true) => {
      ensure(80);
      doc.y += 10;
      const y = doc.y;
      let tx = M;
      if (numbered) {
        sectionNo += 1;
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(GOLD_DEEP).text(String(sectionNo).padStart(2, "0"), M, y + 3, { lineBreak: false });
        tx = M + 22;
      }
      doc.font("Times-Bold").fontSize(14).fillColor(PURPLE).text(t(title), tx, y, { width: CW - (tx - M) });
      const ly = doc.y + 3;
      doc.moveTo(M, ly).lineTo(M + CW, ly).lineWidth(0.6).strokeColor(GOLD).stroke();
      doc.y = ly + 9;
      doc.x = M;
    };
    const label = (text: string, x: number, y: number, w: number, color = MUTED) =>
      doc.font("Helvetica-Bold").fontSize(6.4).fillColor(color).text(text.toUpperCase(), x, y, { width: w, characterSpacing: 1, lineBreak: false });
    /** A tinted panel with a gold rule on the left. */
    const callout = (title: string, text: string, size = 9.4) => {
      doc.font("Times-Roman").fontSize(size);
      const h = doc.heightOfString(t(text), { width: CW - 30, lineGap: 1.8 }) + 34;
      ensure(h + 8);
      const y = doc.y;
      doc.rect(M, y, CW, h).fill(TINT);
      doc.rect(M, y, 2.5, h).fill(GOLD);
      label(title, M + 16, y + 10, CW - 30, GOLD_DEEP);
      doc.font("Times-Roman").fontSize(size).fillColor(INK).text(t(text), M + 16, y + 22, { width: CW - 30, lineGap: 1.8 });
      doc.y = y + h + 10;
      doc.x = M;
    };

    // ── Cover ─────────────────────────────────────────────────────────
    const bandH = 318;
    doc.rect(0, 0, PAGE_W, bandH).fill(doc.linearGradient(0, 0, PAGE_W, bandH).stop(0, PURPLE_DEEP).stop(1, PURPLE));
    doc.rect(0, bandH, PAGE_W, 2.6).fill(GOLD);
    doc.save().opacity(0.14).lineWidth(0.8).strokeColor(GOLD);
    for (let rr = 26; rr <= 110; rr += 14) doc.circle(PAGE_W - 70, 70, rr).stroke();
    doc.restore();

    doc.font("Helvetica-Bold").fontSize(7.6).fillColor(GOLD).text(t(J.name.toUpperCase()), M, 46, { characterSpacing: 2.2, lineBreak: false });
    doc.font("Times-Italic").fontSize(9.4).fillColor("#d9cff0").text(t(J.tagline), M, 60, { lineBreak: false });

    const badge = `EDITORIAL TAKEAWAYS  ·  ${tk.code}`;
    doc.font("Helvetica-Bold").fontSize(7.4);
    const badgeW = doc.widthOfString(badge, { characterSpacing: 1 }) + 22;
    doc.roundedRect(M, 104, badgeW, 20, 3).lineWidth(0.8).strokeColor(GOLD).stroke();
    doc.fillColor(GOLD).text(badge, M + 11, 110.5, { characterSpacing: 1, lineBreak: false });

    doc.font("Times-Bold").fontSize(r.title.length > 60 ? 22 : 26).fillColor("#ffffff").text(t(r.title), M, 140, { width: CW - 30, lineGap: 2 });
    if (r.subtitle) {
      doc.moveDown(0.15);
      doc.font("Times-Italic").fontSize(12.5).fillColor("#e4dcf5").text(t(r.subtitle), M, doc.y, { width: CW - 40, lineGap: 1.5 });
    }
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(9.4).fillColor("#e4dcf5")
      .text(t(`An independent editorial reading of a ${r.year} open-access ${r.type.toLowerCase()} published by ${r.publisher}.`), M, doc.y, { width: CW - 40, lineGap: 2 });
    doc.font("Helvetica-Bold").fontSize(7).fillColor(GOLD)
      .text(t(`PREPARED ${fmtLong(tk.preparedOn).toUpperCase()}  ·  ${tk.takeaways.length} KEY TAKEAWAYS`), M, bandH - 30, { characterSpacing: 1.2, lineBreak: false });

    // About the original + document control, in two-column rows.
    const colW = (CW - 18) / 2;
    const rows = (title: string, y0: number, pairs: [string, string][]) => {
      doc.font("Helvetica-Bold").fontSize(7).fillColor(PURPLE).text(title, M, y0, { characterSpacing: 1.6, lineBreak: false });
      let ry = y0 + 14;
      for (let i = 0; i < pairs.length; i += 2) {
        const pair = pairs.slice(i, i + 2);
        doc.font("Helvetica").fontSize(8.4);
        const h = Math.max(...pair.map(([, v]) => doc.heightOfString(t(v), { width: colW }))) + 16;
        pair.forEach(([k, v], j) => {
          const x = M + j * (colW + 18);
          label(k, x, ry, colW);
          doc.font("Helvetica").fontSize(8.4).fillColor(INK).text(t(v), x, ry + 9, { width: colW });
        });
        doc.moveTo(M, ry + h - 4).lineTo(M + CW, ry + h - 4).lineWidth(0.4).strokeColor(RULE).stroke();
        ry += h;
      }
      return ry;
    };
    const identifier = r.doi ? `DOI ${r.doi}` : r.isbn ? `ISBN ${r.isbn}` : r.issn ? `ISSN ${r.issn}` : r.reportCode ?? source;
    let ry = rows("ABOUT THE ORIGINAL PUBLICATION", bandH + 24, [
      ["Publisher", r.publisher],
      ["Author(s)", r.creators.length > 150 ? `${r.creators.slice(0, 147).replace(/[\s,;]+\S*$/, "")}…` : r.creators],
      ["Year · length", `${r.year} · ${r.pages} pages · ${r.language}`],
      ["Identifier", identifier],
      ["Rights holder", r.rightsHolder],
      ["Licence", `${r.licence.code}`],
    ]);
    ry = rows("THIS DOCUMENT", ry + 8, [
      ["Document code", tk.code],
      ["Prepared by", TAKEAWAYS_AUTHOR],
      ["Nature", "Independent editorial commentary"],
      ["Endorsement", "None: not reviewed by the publisher or authors"],
    ]);

    // Identity block with QR to the original publication.
    const iy = PAGE_H - 196;

    // Contents, as on the guide covers (body numbering matches).
    const contents: [string, string][] = [
      ["·", "Independence notice"],
      ["·", "At a glance"],
      ["01", `Key takeaways (${tk.takeaways.length})`],
      ["02", "Why it matters: the Eleventh Press view"],
      ["03", "Questions for further research"],
      ["·", "The original publication and its licence"],
      ["·", "How to cite"],
    ];
    const contentRows = Math.ceil(contents.length / 2);
    ry += 14;
    if (ry + 14 + contentRows * 12.5 < iy - 12) {
      doc.font("Helvetica-Bold").fontSize(7).fillColor(PURPLE).text("CONTENTS", M, ry, { characterSpacing: 1.6, lineBreak: false });
      ry += 14;
      contents.forEach(([num, c], i) => {
        const col = i < contentRows ? 0 : 1;
        const row = col === 0 ? i : i - contentRows;
        const x = M + col * (colW + 18);
        const y = ry + row * 12.5;
        doc.font("Helvetica-Bold").fontSize(7.2).fillColor(GOLD_DEEP).text(num, x, y + 0.8, { width: 16, lineBreak: false });
        doc.font("Helvetica").fontSize(8.4).fillColor(INK).text(t(c), x + 18, y, { lineBreak: false });
      });
    }
    doc.roundedRect(M, iy, CW, 112, 6).fillAndStroke("#fbfaff", RULE);
    doc.rect(M, iy, 3, 112).fill(GOLD);
    doc.image(qr, M + CW - 96, iy + 12, { width: 86, height: 86 });
    const ix = M + 18;
    const iw = CW - 130;
    doc.font("Times-Bold").fontSize(12.5).fillColor(PURPLE).text(t(J.name), ix, iy + 14, { width: iw });
    doc.font("Helvetica").fontSize(8.2).fillColor(MUTED).text(t(J.tagline), ix, doc.y + 1, { width: iw });
    const idLines = [issnLine, brand.location, [brand.email, host].filter(Boolean).join("  ·  ")].filter((l): l is string => !!l);
    doc.font("Helvetica").fontSize(8.2).fillColor(INK);
    let ly = doc.y + 7;
    for (const line of idLines) {
      doc.text(t(line), ix, ly, { width: iw, lineBreak: false });
      ly += 12;
    }
    doc.font("Helvetica-Oblique").fontSize(7).fillColor(MUTED).text("Scan to read the original publication", M + CW - 112, iy + 100, { width: 118, align: "center", lineBreak: false });

    // ── Body ──────────────────────────────────────────────────────────
    newPage();
    callout("Independence notice", TAKEAWAYS_NOTICE);

    heading("At a glance", false);
    paragraph(r.summary, 4);
    label("Who should read the original", M, doc.y + 2, CW, GOLD_DEEP);
    doc.y += 12;
    paragraph(r.audience, 2);

    heading("Key takeaways");
    tk.takeaways.forEach((k, i) => {
      doc.font("Times-Bold").fontSize(10.8);
      const th = doc.heightOfString(t(k.title), { width: CW - 44 });
      bodyFont();
      const bh = doc.heightOfString(t(k.text), { width: CW - 44, lineGap: 2 });
      const h = th + bh + 18;
      ensure(h);
      const y = doc.y;
      doc.rect(M, y, CW, h).fill(i % 2 === 0 ? TINT : "#ffffff");
      doc.circle(M + 14, y + 15, 8).fill(PURPLE);
      doc.font("Helvetica-Bold").fontSize(7.6).fillColor("#ffffff").text(String(i + 1), M + 6, y + 11.6, { width: 16, align: "center", lineBreak: false });
      doc.font("Times-Bold").fontSize(10.8).fillColor(INK).text(t(k.title), M + 32, y + 8, { width: CW - 44 });
      bodyFont();
      doc.text(t(k.text), M + 32, doc.y + 2, { width: CW - 44, lineGap: 2 });
      doc.y = y + h;
    });
    doc.rect(M, doc.y, CW, 1.4).fill(GOLD);
    doc.y += 8;

    heading("Why it matters: the Eleventh Press view");
    paragraph(tk.whyItMatters);

    heading("Questions for further research");
    paragraph("Open questions the publication raises for researchers, offered as starting points for new studies.", 6);
    tk.researchQuestions.forEach((q, i) => {
      bodyFont();
      const h = doc.heightOfString(t(q), { width: CW - 22, lineGap: 2.2 });
      ensure(h + 6);
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(7.8).fillColor(GOLD_DEEP).text(`Q${i + 1}`, M, y + 2, { width: 18, lineBreak: false });
      bodyFont();
      doc.text(t(q), M + 22, y, { width: CW - 22, lineGap: 2.2 });
      doc.y += 5;
    });

    heading("The original publication and its licence", false);
    const terms = termsFor(r);
    const credit = [
      `${r.rightsHolder}. ${fullTitle}. ${r.publisher}, ${r.year}.`,
      `Available free in Open Access under the ${r.licence.name} (${r.licence.code}) licence: ${r.licence.url}.`,
      terms ? `Use of the original is subject to the ${terms.label}: ${terms.url}.` : "",
      r.licenceSource ?? "",
      r.extractOf ?? "",
      isNonCommercial(r) ? "Its licence does not permit commercial use; Eleventh Press provides these takeaways free of charge." : "",
      r.coverRights ? `The cover image (${r.coverRights.label}) belongs to ${r.coverRights.owner.replace(/^The /, "the ")} and is not covered by the open licence; it is deliberately not reproduced here.` : "",
      r.thirdPartyNotice ?? "",
    ].filter(Boolean).join(" ");
    paragraph(credit, 6, "left");
    doc.font("Helvetica").fontSize(8.2).fillColor(PURPLE).text(t(`Read or download the original: ${source}`), M, doc.y, { width: CW, link: source });
    doc.y += 8;

    callout("How to cite the original publication", r.citation, 9.6);
    callout("How to cite these takeaways", takeawaysCitation(r, tk, BASE), 9.6);

    doc.font("Helvetica").fontSize(7.6).fillColor(MUTED).text(
      t(
        `© ${tk.preparedOn.slice(0, 4)} ${J.name}. These takeaways are original editorial commentary by Eleventh Press and do not reproduce the publication. ` +
          `You may share this PDF free of charge in full and unchanged, with credit to Eleventh Press. The publication remains the property of its rights holder, ` +
          `and its inclusion in the Eleventh Press Open Resources collection (${BASE}${TAKEAWAYS_ONLINE_PATH}) does not imply any affiliation with, or endorsement by, its publisher or authors. ` +
          `Questions: ${brand.email}.`
      ),
      M,
      doc.y,
      { width: CW, lineGap: 1 }
    );

    // ── Per-page chrome ───────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      const pageNo = i - range.start + 1;

      doc.save().lineWidth(0.7).strokeColor(GOLD).rect(16, 16, PAGE_W - 32, PAGE_H - 32).stroke();
      doc.lineWidth(0.3).strokeColor(GOLD).rect(20, 20, PAGE_W - 40, PAGE_H - 40).stroke().restore();

      if (pageNo > 1) {
        doc.save();
        doc.rotate(-54, { origin: [PAGE_W / 2, PAGE_H / 2] });
        doc.font("Helvetica-Bold").fontSize(26).fillColor(PURPLE).fillOpacity(0.045);
        const wm = t(J.name);
        const wmW = doc.widthOfString(wm, { characterSpacing: 1 });
        doc.text(wm, PAGE_W / 2 - wmW / 2, PAGE_H / 2 - 14, { lineBreak: false, characterSpacing: 1 });
        doc.restore();

        doc.font("Helvetica-Bold").fontSize(6.5).fillColor(GOLD_DEEP);
        let run = `EDITORIAL TAKEAWAYS  ·  ${r.title.toUpperCase()}`;
        while (run.length > 20 && doc.widthOfString(t(run), { characterSpacing: 1.2 }) > CW - 90) run = `${run.slice(0, -2).trimEnd()}…`;
        doc.text(t(run), M, 38, { width: CW - 80, characterSpacing: 1.2, lineBreak: false });
        doc.font("Helvetica").fontSize(7).fillColor(MUTED).text(tk.code, M, 38, { width: CW, align: "right", lineBreak: false });
        doc.moveTo(M, 51).lineTo(M + CW, 51).lineWidth(0.5).strokeColor(RULE).stroke();
      }

      const fy = PAGE_H - 52;
      doc.moveTo(M, fy).lineTo(M + CW, fy).lineWidth(0.5).strokeColor(GOLD).stroke();
      doc.font("Helvetica-Bold").fontSize(6.6).fillColor(PURPLE)
        .text(t(`${J.name.toUpperCase()}  ·  ${tk.code}  ·  EDITORIAL COMMENTARY`), M, fy + 7, { characterSpacing: 0.8, lineBreak: false });
      doc.font("Helvetica").fontSize(6.8).fillColor(MUTED).text(`Page ${pageNo} of ${range.count}`, M, fy + 7, { width: CW, align: "right", lineBreak: false });
      doc.font("Helvetica").fontSize(6.4).fillColor(MUTED).text(t(contactLine), M, fy + 17, { width: CW, lineBreak: false });

      doc.page.margins.bottom = savedBottom;
    }

    doc.end();
  });
}
