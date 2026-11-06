/**
 * Official PDF editions of the Resources guides (/resources/guides/[slug]/pdf).
 *
 * Same PDFKit renderer family and purple/gold house palette as the
 * provenance certificate (src/lib/provenance-certificate-pdf.ts) and the
 * service certificates: pure JS with standard fonts, so it runs on Vercel's
 * serverless runtime with no native binaries.
 *
 * Page layout:
 * - Cover: masthead band, guide title, document-control panel, the
 *   standards it is benchmarked against, and the journal identity block
 *   with a QR code to the online edition.
 * - Body: purpose and scope, the ten key requirements, the benchmarked
 *   standards table, the numbered sections, the compliance checklist,
 *   FAQs, and how to cite the guide.
 * - Every page: double hairline frame, faint diagonal watermark, running
 *   header (from page 2) and a footer with the document code and page
 *   count.
 *
 * Rendered from the same GuideDoc the web page renders, so the two editions
 * can't drift.
 */
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { APP_BASE_URL, JOURNAL_IDENTITY } from "@/lib/site";
import { pdfSafe } from "@/lib/provenance-certificate-pdf";
import { fmtLongDate, guideById, guideCitation, guidePath, type FullGuide } from "@/lib/resources";

const PURPLE = "#4c1d95";
const PURPLE_DEEP = "#2a1458";
const GOLD = "#c9a55c";
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

const J = JOURNAL_IDENTITY;

export function guidePdfFileName(g: FullGuide): string {
  const slug = g.slug.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  return `eleventh-press-${g.code.toLowerCase()}-${slug}-v${g.version}.pdf`;
}

export async function buildGuidePdf(g: FullGuide): Promise<Buffer> {
  const onlineUrl = `${APP_BASE_URL}${guidePath(g)}`;
  const qr = await QRCode.toBuffer(onlineUrl, { errorCorrectionLevel: "M", margin: 1, width: 240, color: { dark: INK, light: "#ffffff" } });

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: TOP, bottom: BOTTOM_MARGIN, left: M, right: M },
      bufferPages: true,
      info: {
        Title: pdfSafe(`${g.title} (${g.code}, Version ${g.version})`),
        Author: J.name,
        Subject: pdfSafe(g.summary),
        Keywords: pdfSafe([...g.keywords, ...g.benchmarks].join(", ")),
        Creator: `${J.name} — Editorial Office`,
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
    const paragraph = (text: string, gapAfter = 7) => {
      bodyFont();
      ensure(Math.min(doc.heightOfString(t(text), { width: CW, lineGap: 2.4 }), 40));
      doc.text(t(text), M, doc.y, { width: CW, align: "justify", lineGap: 2.4 });
      doc.y += gapAfter;
    };
    const bullet = (text: string, marker?: string) => {
      bodyFont();
      const h = doc.heightOfString(t(text), { width: CW - 18, lineGap: 2.2 });
      ensure(h + 4);
      const y = doc.y;
      if (marker) {
        doc.font("Helvetica-Bold").fontSize(7.8).fillColor(GOLD_DEEP).text(marker, M, y + 2, { width: 16, lineBreak: false });
      } else {
        doc.save().rect(M + 3, y + 4.6, 3.6, 3.6).fill(GOLD).restore();
      }
      bodyFont();
      doc.text(t(text), M + 18, y, { width: CW - 18, align: "left", lineGap: 2.2 });
      doc.y += 3.5;
    };
    let sectionNo = 0;
    const heading = (title: string, numbered = true) => {
      ensure(70);
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

    // ── Cover ─────────────────────────────────────────────────────────
    const bandH = 300;
    doc.rect(0, 0, PAGE_W, bandH).fill(doc.linearGradient(0, 0, PAGE_W, bandH).stop(0, PURPLE_DEEP).stop(1, PURPLE));
    doc.rect(0, bandH, PAGE_W, 2.6).fill(GOLD);
    // Concentric seal motif, top right.
    doc.save().opacity(0.14).lineWidth(0.8).strokeColor(GOLD);
    for (let r = 26; r <= 110; r += 14) doc.circle(PAGE_W - 70, 70, r).stroke();
    doc.restore();

    doc.font("Helvetica-Bold").fontSize(7.6).fillColor(GOLD).text(J.name.toUpperCase(), M, 46, { characterSpacing: 2.2, lineBreak: false });
    doc.font("Times-Italic").fontSize(9.4).fillColor("#d9cff0").text(J.tagline, M, 60, { lineBreak: false });

    const badge = `OFFICIAL GUIDE  ·  ${g.code}`;
    doc.font("Helvetica-Bold").fontSize(7.4);
    const badgeW = doc.widthOfString(badge, { characterSpacing: 1 }) + 22;
    doc.roundedRect(M, 104, badgeW, 20, 3).lineWidth(0.8).strokeColor(GOLD).stroke();
    doc.fillColor(GOLD).text(badge, M + 11, 110.5, { characterSpacing: 1, lineBreak: false });

    doc.font("Times-Bold").fontSize(29).fillColor("#ffffff").text(t(g.title), M, 140, { width: CW - 30, lineGap: 2 });
    doc.moveDown(0.35);
    doc.font("Helvetica").fontSize(9.8).fillColor("#e4dcf5").text(t(g.summary), M, doc.y, { width: CW - 40, lineGap: 2 });
    doc.font("Helvetica-Bold").fontSize(7).fillColor(GOLD).text(`VERSION ${g.version}  ·  EFFECTIVE ${fmtLongDate(g.effective).toUpperCase()}`, M, bandH - 30, { characterSpacing: 1.2, lineBreak: false });

    // Document control panel.
    const py = bandH + 26;
    doc.font("Helvetica-Bold").fontSize(7).fillColor(PURPLE).text("DOCUMENT CONTROL", M, py, { characterSpacing: 1.6, lineBreak: false });
    const rows: [string, string][] = [
      ["Document code", g.code],
      ["Version", `${g.version} (supersedes all earlier editions)`],
      ["Effective date", fmtLongDate(g.effective)],
      ["Next scheduled review", fmtLongDate(g.nextReview)],
      ["Document owner", `Editorial Office, ${J.name}`],
      ["Status", "Approved for publication"],
      ["Intended audience", g.audience],
      ["Licence", `${J.license} — free to share and adapt with attribution`],
    ];
    const colW = (CW - 18) / 2;
    let ry = py + 14;
    for (let i = 0; i < rows.length; i += 2) {
      const pair = rows.slice(i, i + 2);
      doc.font("Helvetica").fontSize(8.8);
      const h = Math.max(...pair.map(([, v]) => doc.heightOfString(t(v), { width: colW }))) + 17;
      pair.forEach(([k, v], j) => {
        const x = M + j * (colW + 18);
        label(k, x, ry, colW);
        doc.font("Helvetica").fontSize(8.8).fillColor(INK).text(t(v), x, ry + 9, { width: colW });
      });
      doc.moveTo(M, ry + h - 4).lineTo(M + CW, ry + h - 4).lineWidth(0.4).strokeColor(RULE).stroke();
      ry += h;
    }

    // Benchmarked against.
    ry += 10;
    doc.font("Helvetica-Bold").fontSize(7).fillColor(PURPLE).text("BENCHMARKED AGAINST", M, ry, { characterSpacing: 1.6, lineBreak: false });
    ry += 14;
    let cx = M;
    doc.font("Helvetica-Bold").fontSize(7.6);
    for (const b of g.benchmarks) {
      const w = doc.widthOfString(t(b)) + 16;
      if (cx + w > M + CW) {
        cx = M;
        ry += 20;
      }
      doc.roundedRect(cx, ry, w, 15, 7.5).fillAndStroke(TINT, "#d8cdee");
      doc.font("Helvetica-Bold").fontSize(7.6).fillColor(PURPLE).text(t(b), cx + 8, ry + 4.2, { lineBreak: false });
      cx += w + 6;
    }

    // Contents.
    const iy = PAGE_H - 200;
    ry += 30;
    // Unnumbered front matter, then the numbered sections exactly as the
    // body numbers them (sections, checklist, FAQs).
    const contents: [string, string][] = [
      ["·", "Purpose and scope"],
      ["·", "At a glance: ten key requirements"],
      ["·", "Benchmarked standards and basis"],
      ...[...g.sections.map((s) => s.heading), "Compliance checklist", "Frequently asked questions"].map(
        (h, i) => [String(i + 1).padStart(2, "0"), h] as [string, string]
      ),
    ];
    const contentRows = Math.ceil(contents.length / 2);
    const fit = (text: string, w: number) => {
      doc.font("Helvetica").fontSize(8.4);
      if (doc.widthOfString(text) <= w) return text;
      let cut = text;
      while (cut.length > 4 && doc.widthOfString(`${cut}…`) > w) cut = cut.slice(0, -1);
      return `${cut.trimEnd()}…`;
    };
    if (ry + 14 + contentRows * 12.5 < iy - 12) {
      doc.font("Helvetica-Bold").fontSize(7).fillColor(PURPLE).text("CONTENTS", M, ry, { characterSpacing: 1.6, lineBreak: false });
      ry += 14;
      contents.forEach(([num, c], i) => {
        const col = i < contentRows ? 0 : 1;
        const row = col === 0 ? i : i - contentRows;
        const x = M + col * (colW + 18);
        const y = ry + row * 12.5;
        doc.font("Helvetica-Bold").fontSize(7.2).fillColor(GOLD_DEEP).text(num, x, y + 0.8, { width: 16, lineBreak: false });
        doc.font("Helvetica").fontSize(8.4).fillColor(INK).text(fit(t(c), colW - 22), x + 18, y, { lineBreak: false });
      });
    }

    // Journal identity block (bottom of cover).
    doc.roundedRect(M, iy, CW, 112, 6).fillAndStroke("#fbfaff", RULE);
    doc.rect(M, iy, 3, 112).fill(GOLD);
    doc.image(qr, M + CW - 96, iy + 12, { width: 86, height: 86 });
    const ix = M + 18;
    const iw = CW - 130;
    doc.font("Times-Bold").fontSize(12.5).fillColor(PURPLE).text(J.name, ix, iy + 14, { width: iw });
    doc.font("Helvetica").fontSize(8.2).fillColor(MUTED).text(J.tagline, ix, doc.y + 1, { width: iw });
    const idLines = [
      `ISSN ${J.issn} (Online)  ·  Publisher DOI prefix ${J.doiPrefix}`,
      `Established ${J.established}  ·  ${J.location}`,
      `${J.editorialEmail}  ·  ${APP_BASE_URL.replace(/^https?:\/\//, "")}`,
    ];
    doc.font("Helvetica").fontSize(8.2).fillColor(INK);
    let ly = doc.y + 7;
    for (const line of idLines) {
      doc.text(line, ix, ly, { width: iw, lineBreak: false });
      ly += 12;
    }
    doc.font("Helvetica-Oblique").fontSize(7).fillColor(MUTED).text("Scan for the current online edition", M + CW - 110, iy + 100, { width: 114, align: "center", lineBreak: false });

    // ── Body ──────────────────────────────────────────────────────────
    newPage();

    heading("Purpose and scope", false);
    label("Purpose", M, doc.y, CW, GOLD_DEEP);
    doc.y += 10;
    paragraph(g.purpose);
    label("Scope", M, doc.y, CW, GOLD_DEEP);
    doc.y += 10;
    paragraph(g.scope);
    label("Audience", M, doc.y, CW, GOLD_DEEP);
    doc.y += 10;
    paragraph(g.audience, 4);

    // Key requirements panel.
    heading("At a glance: ten key requirements", false);
    for (let i = 0; i < g.keyPoints.length; i++) {
      bodyFont();
      const h = doc.heightOfString(t(g.keyPoints[i]), { width: CW - 40, lineGap: 2 }) + 9;
      ensure(h);
      const y = doc.y;
      doc.rect(M, y, CW, h).fill(i % 2 === 0 ? TINT : "#ffffff");
      doc.circle(M + 13, y + h / 2, 7.5).fill(PURPLE);
      doc.font("Helvetica-Bold").fontSize(7.4).fillColor("#ffffff").text(String(i + 1), M + 5.5, y + h / 2 - 3, { width: 15, align: "center", lineBreak: false });
      bodyFont();
      doc.text(t(g.keyPoints[i]), M + 30, y + 4.5, { width: CW - 40, lineGap: 2 });
      doc.y = y + h;
    }
    doc.rect(M, doc.y, CW, 1.4).fill(GOLD);
    doc.y += 8;

    // Benchmarked standards table.
    heading("Benchmarked standards and basis", false);
    paragraph(
      "This guide is benchmarked against the external standards below. “Aligned with” describes the standard each requirement follows; it is not a claim of membership in, or certification by, the issuing body.",
      9
    );
    const c1 = 168;
    const c2 = 92;
    const c3 = CW - c1 - c2;
    const tableHeader = () => {
      const y = doc.y;
      doc.rect(M, y, CW, 18).fill(PURPLE);
      label("Standard and issuing body", M + 7, y + 6, c1 - 10, "#ffffff");
      label("Edition", M + c1 + 5, y + 6, c2 - 8, "#ffffff");
      label("How this guide applies it", M + c1 + c2 + 5, y + 6, c3 - 10, "#ffffff");
      doc.y = y + 18;
    };
    ensure(60);
    tableHeader();
    g.standards.forEach((s, i) => {
      doc.font("Helvetica-Bold").fontSize(8.4);
      const h1 = doc.heightOfString(t(s.name), { width: c1 - 12 });
      doc.font("Helvetica").fontSize(7.6);
      const h1b = doc.heightOfString(t(s.issuer), { width: c1 - 12 });
      const h1c = doc.heightOfString(s.url, { width: c1 - 12 });
      const h2 = doc.heightOfString(t(s.edition), { width: c2 - 10 });
      doc.font("Times-Roman").fontSize(9.2);
      const h3 = doc.heightOfString(t(s.application), { width: c3 - 12, lineGap: 1 });
      const h = Math.max(h1 + h1b + h1c + 6, h2, h3) + 12;
      if (doc.y + h > BOTTOM_LIMIT) {
        newPage();
        tableHeader();
      }
      const y = doc.y;
      doc.rect(M, y, CW, h).fill(i % 2 === 0 ? "#ffffff" : TINT);
      doc.font("Helvetica-Bold").fontSize(8.4).fillColor(INK).text(t(s.name), M + 7, y + 6, { width: c1 - 12 });
      doc.font("Helvetica").fontSize(7.6).fillColor(MUTED).text(t(s.issuer), M + 7, doc.y + 1, { width: c1 - 12 });
      doc.font("Helvetica").fontSize(7.2).fillColor(PURPLE).text(s.url, M + 7, doc.y + 2, { width: c1 - 12, link: s.url });
      doc.font("Helvetica").fontSize(7.6).fillColor(INK).text(t(s.edition), M + c1 + 5, y + 6, { width: c2 - 10 });
      doc.font("Times-Roman").fontSize(9.2).fillColor(BODY).text(t(s.application), M + c1 + c2 + 5, y + 6, { width: c3 - 12, lineGap: 1 });
      doc.moveTo(M, y + h).lineTo(M + CW, y + h).lineWidth(0.4).strokeColor(RULE).stroke();
      doc.y = y + h;
    });
    doc.y += 6;
    doc.x = M;

    // Numbered sections.
    for (const s of g.sections) {
      heading(s.heading);
      s.paragraphs.forEach((p) => paragraph(p));
      if (s.bullets) {
        s.bullets.forEach((b) => bullet(b));
        doc.y += 4;
      }
      if (s.after) paragraph(s.after);
    }

    // Compliance checklist.
    heading("Compliance checklist");
    paragraph("Use this checklist before you submit, review or report. Every item reflects a requirement set out above.", 6);
    g.checklist.forEach((c) => {
      bodyFont();
      const h = doc.heightOfString(t(c), { width: CW - 22, lineGap: 2 });
      ensure(h + 6);
      const y = doc.y;
      doc.roundedRect(M + 1, y + 1.5, 9, 9, 1.5).lineWidth(0.9).strokeColor(PURPLE).stroke();
      bodyFont();
      doc.text(t(c), M + 20, y, { width: CW - 22, lineGap: 2 });
      doc.y += 5;
    });

    // FAQs.
    heading("Frequently asked questions");
    for (const f of g.faqs) {
      doc.font("Times-Bold").fontSize(10.8);
      const qh = doc.heightOfString(t(f.q), { width: CW });
      ensure(qh + 30);
      doc.fillColor(INK).text(t(f.q), M, doc.y, { width: CW });
      doc.y += 2;
      paragraph(f.a, 9);
    }

    // Related guides and citation.
    heading("Related guides and how to cite this guide", false);
    const related = g.relatedGuides.map(guideById).filter((x): x is NonNullable<typeof x> => !!x);
    for (const r of related) {
      ensure(30);
      const y = doc.y;
      doc.save().rect(M + 3, y + 4.6, 3.6, 3.6).fill(GOLD).restore();
      doc.font("Times-Bold").fontSize(10.4).fillColor(INK).text(t(`${r.code} — ${r.title}`), M + 18, y, { width: CW - 18 });
      const url = `${APP_BASE_URL}${guidePath(r)}`;
      doc.font("Helvetica").fontSize(7.8).fillColor(PURPLE).text(url, M + 18, doc.y + 1, { width: CW - 18, link: url });
      doc.y += 5;
    }
    doc.y += 6;
    const cite = t(guideCitation(g));
    doc.font("Times-Roman").fontSize(10);
    const chh = doc.heightOfString(cite, { width: CW - 28, lineGap: 1.5 }) + 20;
    ensure(chh + 60);
    const cy = doc.y;
    doc.rect(M, cy, CW, chh).fill(TINT);
    doc.rect(M, cy, 2.5, chh).fill(GOLD);
    doc.font("Times-Roman").fontSize(10).fillColor(INK).text(cite, M + 16, cy + 10, { width: CW - 28, lineGap: 1.5 });
    doc.y = cy + chh + 10;
    doc.font("Helvetica").fontSize(7.8).fillColor(MUTED).text(
      t(
        `This PDF is the official printable edition of ${g.code}, Version ${g.version}. The online edition at ${APP_BASE_URL}${guidePath(g)} is authoritative and is updated whenever the guide is revised. Questions about this guide: ${J.editorialEmail}. © ${g.effective.slice(0, 4)} ${J.name}. Licensed under ${J.license} (${J.licenseUrl}).`
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
        const wm = J.name;
        const wmW = doc.widthOfString(wm, { characterSpacing: 1 });
        doc.text(wm, PAGE_W / 2 - wmW / 2, PAGE_H / 2 - 14, { lineBreak: false, characterSpacing: 1 });
        doc.restore();

        doc.font("Helvetica-Bold").fontSize(6.5).fillColor(GOLD_DEEP)
          .text(t(`OFFICIAL GUIDE  ·  ${g.title.toUpperCase()}`), M, 38, { width: CW - 90, characterSpacing: 1.2, lineBreak: false });
        doc.font("Helvetica").fontSize(7).fillColor(MUTED).text(`${g.code}  ·  v${g.version}`, M, 38, { width: CW, align: "right", lineBreak: false });
        doc.moveTo(M, 51).lineTo(M + CW, 51).lineWidth(0.5).strokeColor(RULE).stroke();
      }

      const fy = PAGE_H - 52;
      doc.moveTo(M, fy).lineTo(M + CW, fy).lineWidth(0.5).strokeColor(GOLD).stroke();
      doc.font("Helvetica-Bold").fontSize(6.6).fillColor(PURPLE)
        .text(`${J.name.toUpperCase()}  ·  ${g.code}  ·  VERSION ${g.version}`, M, fy + 7, { characterSpacing: 0.8, lineBreak: false });
      doc.font("Helvetica").fontSize(6.8).fillColor(MUTED).text(`Page ${pageNo} of ${range.count}`, M, fy + 7, { width: CW, align: "right", lineBreak: false });
      doc.font("Helvetica").fontSize(6.4).fillColor(MUTED)
        .text(`ISSN ${J.issn} (Online)  ·  ${J.location}  ·  ${J.editorialEmail}  ·  ${APP_BASE_URL.replace(/^https?:\/\//, "")}`, M, fy + 17, { width: CW, lineBreak: false });

      doc.page.margins.bottom = savedBottom;
    }

    doc.end();
  });
}
