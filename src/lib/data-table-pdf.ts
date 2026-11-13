/**
 * "Export PDF" for one Supplemental-tab data table — a journal-branded,
 * citable document rather than a bare grid: the publication record (title,
 * authors and affiliations, journal, publisher, ISSN, volume/issue, dates,
 * DOI, licence, keywords), the table exactly as published (headers repeated
 * on every page, section rows set off, nothing altered), descriptive
 * statistics for its genuinely numeric columns, and a ready-to-paste
 * citation. Same PDFKit renderer family and purple/gold palette as the
 * guide and provenance-certificate PDFs (pure JS, standard fonts — runs on
 * Vercel's serverless runtime).
 */
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { JOURNAL_IDENTITY } from "@/lib/site";
import { pdfSafe } from "@/lib/provenance-certificate-pdf";
import { formatCitation, parseAuthors } from "@/lib/article";
import { chartRows, parseNumericCell, type ExtractedTable } from "@/lib/data-tables";

const PURPLE = "#4c1d95";
const PURPLE_DEEP = "#2a1458";
const GOLD = "#c9a55c";
const GOLD_DEEP = "#8a6a28";
const INK = "#241b3a";
const BODY = "#2e2742";
const MUTED = "#6b6478";
const RULE = "#e4dfee";
const TINT = "#f7f4fc";
const ZEBRA = "#fbfaFD";
const SECTION = "#f3ecdc";

const J = JOURNAL_IDENTITY;

export interface DataTablePdfArticle {
  id: string;
  title: string;
  /** JSON-stringified ArticleAuthor[], as stored on Article. */
  authors: string;
  doi?: string | null;
  publishedAt?: Date | string | null;
  submittedAt?: Date | string | null;
  acceptedAt?: Date | string | null;
  keywords?: string | null;
  discipline?: string | null;
  contentType?: string | null;
  journalName: string;
  journalIssn?: string | null;
  publisher?: string | null;
  volume?: number | null;
  issueNumber?: number | null;
  year?: number | null;
  articleUrl: string;
  /**
   * Set for a whitelabel tenant's article: the tenant's own name, tagline
   * and contact email replace Eleventh Press's, and no platform ISSN is
   * ever printed.
   */
  whitelabel?: { name: string; tagline?: string | null; email?: string | null } | null;
}

export interface DataTablePdfInput {
  article: DataTablePdfArticle;
  table: ExtractedTable;
  /** 1-based position of this table in the article. */
  tableNumber: number;
  tableCount: number;
  generatedAt?: Date;
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function fmtNum(n: number): string {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export interface ColumnStats {
  column: number;
  name: string;
  n: number;
  mean: number;
  sd: number | null;
  min: number;
  max: number;
}

/** Descriptive statistics over the table's real data rows only (section
 * rows and blank cells excluded). Computed, never estimated. */
export function describeNumericColumns(table: ExtractedTable): ColumnStats[] {
  const rows = chartRows(table);
  return table.numericColumns.flatMap((col) => {
    const vals = rows.map((r) => parseNumericCell(table.rows[r][col])).filter((v): v is number => v !== null);
    if (vals.length === 0) return [];
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = vals.length > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length - 1)) : null;
    return [{
      column: col,
      name: table.headers[col]?.trim() || `Column ${col + 1}`,
      n: vals.length,
      mean,
      sd,
      min: Math.min(...vals),
      max: Math.max(...vals),
    }];
  });
}

/** Column widths that fit `total`: each column gets at least its longest
 * word (so words aren't split when avoidable), then the remaining room goes
 * to the columns whose content needs it most. */
export function fitColumnWidths(natural: number[], minimum: number[], total: number): number[] {
  const nat = natural.map((n, i) => Math.max(n, minimum[i]));
  const sumNat = nat.reduce((a, b) => a + b, 0);
  if (sumNat <= total) {
    const extra = (total - sumNat) / nat.length;
    return nat.map((n) => n + extra);
  }
  const sumMin = minimum.reduce((a, b) => a + b, 0);
  if (sumMin >= total) return minimum.map((m) => (m / sumMin) * total);
  const slack = nat.map((n, i) => n - minimum[i]);
  const sumSlack = slack.reduce((a, b) => a + b, 0) || 1;
  const room = total - sumMin;
  return minimum.map((m, i) => m + (slack[i] / sumSlack) * room);
}

export function dataTablePdfFileName(article: { title: string }, tableNumber: number): string {
  const slug = article.title
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 8)
    .join("-")
    .toLowerCase()
    .slice(0, 70);
  return `${slug || "article"}-table-${tableNumber}.pdf`;
}

export async function buildDataTablePdf(input: DataTablePdfInput): Promise<Buffer> {
  const { article, table, tableNumber, tableCount } = input;
  const wl = article.whitelabel ?? null;
  const orgName = wl?.name || J.name;
  const issnLine = article.journalIssn || (wl ? null : J.issn);
  const generatedAt = input.generatedAt ?? new Date();
  const t = (s: string | null | undefined) => pdfSafe(s ?? "");
  const qr = await QRCode.toBuffer(article.articleUrl, { errorCorrectionLevel: "M", margin: 1, width: 220, color: { dark: INK, light: "#ffffff" } });

  const columnCount = Math.max(table.headers.length, ...table.rows.map((r) => r.length), 1);
  const headers = Array.from({ length: columnCount }, (_, i) => table.headers[i] ?? "");
  const rows = table.rows.map((r) => Array.from({ length: columnCount }, (_, i) => r[i] ?? ""));
  const sections = new Set(table.sectionRows ?? []);
  const fontSize = columnCount > 10 ? 6.8 : columnCount > 7 ? 7.4 : 8.2;
  const pad = 4;

  // Measure on a scratch document to choose the orientation.
  const probe = new PDFDocument({ size: "A4", autoFirstPage: false });
  const measure = (s: string, bold: boolean) => {
    probe.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize);
    return probe.widthOfString(t(s));
  };
  const longestWord = (s: string, bold: boolean) =>
    t(s).split(/\s+/).reduce((m, w) => Math.max(m, measure(w, bold)), 0);
  const natural = headers.map((h, c) =>
    Math.min(260, Math.max(measure(h, true), ...rows.map((r, ri) => measure(r[c], sections.has(ri)))) + 2 * pad)
  );
  const minimum = headers.map((h, c) =>
    Math.min(110, Math.max(22, longestWord(h, true), ...rows.map((r) => longestWord(r[c], false))) + 2 * pad)
  );
  const landscape = columnCount >= 8 || natural.reduce((a, b) => a + b, 0) > 595.28 * 1.25;

  const PAGE_W = landscape ? 841.89 : 595.28;
  const PAGE_H = landscape ? 595.28 : 841.89;
  const M = landscape ? 46 : 54;
  const CW = PAGE_W - 2 * M;
  const TOP = 66;
  const BOTTOM_MARGIN = 70;
  const BOTTOM_LIMIT = PAGE_H - BOTTOM_MARGIN;
  const widths = fitColumnWidths(natural, minimum, CW);

  const authors = parseAuthors(article.authors);
  const year = article.publishedAt ? new Date(article.publishedAt).getUTCFullYear() : article.year ?? null;
  const tableLabel = `Table ${tableNumber}`;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: landscape ? "landscape" : "portrait",
      margins: { top: TOP, bottom: BOTTOM_MARGIN, left: M, right: M },
      bufferPages: true,
      info: {
        Title: t(`${tableLabel} — ${article.title}`),
        Author: t(authors.map((a) => a.name).join(", ")) || t(orgName),
        Subject: t(`Supplemental data: ${tableLabel} of "${article.title}", ${article.journalName}`),
        Keywords: t(article.keywords ?? ""),
        Creator: t(`${orgName} — Supplemental Materials`),
        Producer: t(orgName),
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const newPage = () => {
      doc.addPage();
      doc.x = M;
      doc.y = TOP;
    };
    const ensure = (h: number) => {
      if (doc.y + h > BOTTOM_LIMIT) newPage();
    };
    const eyebrow = (text: string, x: number, y: number, color = PURPLE) => {
      doc.font("Helvetica-Bold").fontSize(7).fillColor(color).text(text.toUpperCase(), x, y, { characterSpacing: 1.6, lineBreak: false });
    };

    // ── Masthead band ────────────────────────────────────────────────
    const bandH = 150;
    doc.rect(0, 0, PAGE_W, bandH).fill(doc.linearGradient(0, 0, PAGE_W, bandH).stop(0, PURPLE_DEEP).stop(1, PURPLE));
    doc.rect(0, bandH, PAGE_W, 3).fill(GOLD);
    doc.font("Helvetica-Bold").fontSize(7.6).fillColor(GOLD).text(t(orgName).toUpperCase(), M, 34, { characterSpacing: 2.2, lineBreak: false, width: CW - 170, ellipsis: true });
    doc.font("Times-Italic").fontSize(9).fillColor("#d9cff0").text(t(wl ? wl.tagline || article.journalName : J.tagline), M, 47, { width: CW - 170, lineBreak: false });
    const chip = `SUPPLEMENTAL DATA  ·  TABLE ${tableNumber} OF ${tableCount}`;
    doc.font("Helvetica-Bold").fontSize(6.8);
    const chipW = doc.widthOfString(chip, { characterSpacing: 1.1 }) + 18;
    doc.roundedRect(M + CW - chipW, 30, chipW, 17, 8.5).lineWidth(0.8).strokeColor(GOLD).stroke();
    doc.fillColor(GOLD).text(chip, M + CW - chipW + 9, 35.5, { characterSpacing: 1.1, lineBreak: false });

    doc.font("Times-Bold").fontSize(25).fillColor("#ffffff").text(tableLabel, M, 74, { lineBreak: false });
    const capY = 104;
    const caption = table.caption?.trim();
    doc.font("Helvetica").fontSize(9.2).fillColor("#e4dcf5")
      .text(t(caption || `Data table reproduced from the published article "${article.title}"`), M, capY, {
        width: CW, height: bandH - capY - 10, ellipsis: true, lineGap: 1.5,
      });

    // ── Publication record ───────────────────────────────────────────
    let y = bandH + 22;
    eyebrow("Publication record", M, y);
    y += 14;
    const qrSize = 84;
    const recX = M + 12;
    const recW = CW - qrSize - 40;
    const labelW = 82;
    const valueW = recW - labelW;
    const issueBits = [
      article.volume ? `Volume ${article.volume}` : "",
      article.issueNumber ? `Issue ${article.issueNumber}` : "",
      year ? String(year) : "",
    ].filter(Boolean).join(", ");
    const authorLine = authors.length
      ? authors.map((a) => (a.affiliation ? `${a.name} (${a.affiliation})` : a.name)).join("; ")
      : "—";
    const record: [string, string, string?][] = [
      ["Article", article.title],
      ["Authors", authorLine],
      ["Journal", article.journalName],
      ["Publisher", article.publisher || orgName],
      ["ISSN", issnLine ? `${issnLine} (Online)` : "—"],
      ...(issueBits ? ([["Issue", issueBits]] as [string, string][]) : []),
      ["Published", [fmtDate(article.publishedAt), article.acceptedAt ? `accepted ${fmtDate(article.acceptedAt)}` : "", article.submittedAt ? `received ${fmtDate(article.submittedAt)}` : ""].filter(Boolean).join("  ·  ") || "—"],
      ...(article.doi ? ([["DOI", `https://doi.org/${article.doi}`, `https://doi.org/${article.doi}`]] as [string, string, string][]) : []),
      ["Article URL", article.articleUrl, article.articleUrl],
      ...(article.discipline ? ([["Discipline", article.discipline]] as [string, string][]) : []),
      ...(article.keywords ? ([["Keywords", article.keywords.split(",").map((k) => k.trim()).filter(Boolean).join(", ")]] as [string, string][]) : []),
      ["Licence", `${J.license} — reuse permitted with attribution (${J.licenseUrl})`],
    ];
    doc.font("Helvetica").fontSize(8.4);
    const recordH = record.reduce((h, [, v]) => h + doc.heightOfString(t(v), { width: valueW, lineGap: 1 }) + 5, 0) + 18;
    const panelH = Math.max(recordH, qrSize + 44);
    doc.roundedRect(M, y, CW, panelH, 6).fill(TINT);
    doc.rect(M, y, 3, panelH).fill(GOLD);
    let ry = y + 10;
    for (const [label, value, link] of record) {
      doc.font("Helvetica-Bold").fontSize(7).fillColor(GOLD_DEEP).text(label.toUpperCase(), recX, ry + 1.2, { width: labelW - 8, characterSpacing: 0.8 });
      const isTitle = label === "Article";
      doc.font(isTitle ? "Times-Bold" : "Helvetica").fontSize(isTitle ? 9.6 : 8.4).fillColor(link ? PURPLE : INK)
        .text(t(value), recX + labelW, ry, { width: valueW, lineGap: 1, link: link || undefined, underline: false });
      ry = doc.y + 5;
    }
    const qrX = M + CW - qrSize - 14;
    doc.image(qr, qrX, y + 12, { width: qrSize, height: qrSize });
    doc.font("Helvetica-Oblique").fontSize(6.6).fillColor(MUTED)
      .text("Scan to open the article", qrX - 6, y + qrSize + 16, { width: qrSize + 12, align: "center" });
    y += panelH + 22;

    // ── The table ────────────────────────────────────────────────────
    doc.y = y;
    ensure(60);
    eyebrow(`${tableLabel}  ·  ${rows.length} row${rows.length === 1 ? "" : "s"} × ${columnCount} column${columnCount === 1 ? "" : "s"}`, M, doc.y);
    doc.y += 14;

    const cellH = (text: string, w: number, bold: boolean) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize);
      return doc.heightOfString(t(text) || " ", { width: w - 2 * pad, lineGap: 0.8 });
    };
    const drawHeader = (continued: boolean) => {
      if (continued) {
        doc.font("Helvetica-Oblique").fontSize(7.2).fillColor(MUTED).text(`${tableLabel} (continued)`, M, doc.y, { lineBreak: false });
        doc.y += 12;
      }
      const top = doc.y;
      const h = Math.max(...headers.map((hd, c) => cellH(hd, widths[c], true))) + 2 * pad + 2;
      doc.rect(M, top, CW, h).fill(PURPLE);
      let x = M;
      headers.forEach((hd, c) => {
        const numericCol = table.numericColumns.includes(c);
        doc.font("Helvetica-Bold").fontSize(fontSize).fillColor("#ffffff")
          .text(t(hd), x + pad, top + pad + 1, { width: widths[c] - 2 * pad, lineGap: 0.8, align: numericCol ? "right" : "left" });
        x += widths[c];
      });
      doc.y = top + h;
    };

    drawHeader(false);
    rows.forEach((row, ri) => {
      const isSection = sections.has(ri);
      const h = Math.max(...row.map((cell, c) => cellH(cell, widths[c], isSection))) + 2 * pad;
      if (doc.y + h > BOTTOM_LIMIT) {
        newPage();
        drawHeader(true);
      }
      const top = doc.y;
      doc.rect(M, top, CW, h).fill(isSection ? SECTION : ri % 2 === 1 ? ZEBRA : "#ffffff");
      let x = M;
      row.forEach((cell, c) => {
        const numeric = !isSection && table.numericColumns.includes(c) && parseNumericCell(cell) !== null;
        doc.font(isSection ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize).fillColor(isSection ? PURPLE_DEEP : BODY)
          .text(t(cell), x + pad, top + pad, { width: widths[c] - 2 * pad, lineGap: 0.8, align: numeric ? "right" : "left" });
        x += widths[c];
      });
      // Cell rules
      doc.save().lineWidth(0.4).strokeColor(RULE);
      doc.moveTo(M, top + h).lineTo(M + CW, top + h).stroke();
      let vx = M;
      for (let c = 0; c <= columnCount; c++) {
        doc.moveTo(vx, top).lineTo(vx, top + h).stroke();
        vx += widths[c] ?? 0;
      }
      doc.restore();
      doc.y = top + h;
    });
    doc.save().lineWidth(0.9).strokeColor(PURPLE).moveTo(M, doc.y).lineTo(M + CW, doc.y).stroke().restore();
    doc.y += 8;
    doc.font("Helvetica-Oblique").fontSize(7.2).fillColor(MUTED).text(
      t(`Source: ${tableLabel} of the version of record, reproduced without alteration. Blank cells are blank in the published table.${sections.size ? " Shaded rows are section headings within the table." : ""}`),
      M, doc.y, { width: CW, lineGap: 1 }
    );
    doc.y += 14;

    // ── Descriptive statistics (real numeric columns only) ───────────
    const stats = describeNumericColumns(table);
    if (stats.length > 0) {
      ensure(40 + Math.min(stats.length, 4) * 16);
      eyebrow("Descriptive statistics", M, doc.y);
      doc.y += 14;
      const cols = ["Column", "n", "Mean", "SD", "Min", "Max"];
      const sw = [CW * 0.4, CW * 0.1, CW * 0.125, CW * 0.125, CW * 0.125, CW * 0.125];
      const drawRow = (cells: string[], head: boolean, shade: boolean) => {
        doc.font(head ? "Helvetica-Bold" : "Helvetica").fontSize(8);
        const h = Math.max(...cells.map((c, i) => doc.heightOfString(t(c), { width: sw[i] - 2 * pad }))) + 2 * pad;
        ensure(h);
        const top = doc.y;
        if (head) doc.rect(M, top, CW, h).fill(TINT);
        else if (shade) doc.rect(M, top, CW, h).fill(ZEBRA);
        let x = M;
        cells.forEach((c, i) => {
          doc.font(head ? "Helvetica-Bold" : "Helvetica").fontSize(8).fillColor(head ? PURPLE : BODY)
            .text(t(c), x + pad, top + pad, { width: sw[i] - 2 * pad, align: i === 0 ? "left" : "right" });
          x += sw[i];
        });
        doc.save().lineWidth(0.4).strokeColor(RULE).moveTo(M, top + h).lineTo(M + CW, top + h).stroke().restore();
        doc.y = top + h;
      };
      drawRow(cols, true, false);
      stats.forEach((s, i) => drawRow([s.name, String(s.n), fmtNum(s.mean), s.sd === null ? "—" : fmtNum(s.sd), fmtNum(s.min), fmtNum(s.max)], false, i % 2 === 1));
      doc.y += 6;
      doc.font("Helvetica-Oblique").fontSize(7.2).fillColor(MUTED).text(
        "Computed from the table's data rows only (section headings and blank cells excluded); SD is the sample standard deviation.",
        M, doc.y, { width: CW }
      );
      doc.y += 14;
    }

    // ── How to cite ──────────────────────────────────────────────────
    const cite = `${tableLabel} in: ${formatCitation({
      title: article.title,
      authors: article.authors,
      publishedAt: article.publishedAt,
      doi: article.doi,
      journalName: article.journalName,
      volume: article.volume,
      issueNumber: article.issueNumber,
      year: article.year,
    })}`;
    doc.font("Times-Roman").fontSize(9.6);
    const citeH = doc.heightOfString(t(cite), { width: CW - 28, lineGap: 1.5 }) + 34;
    ensure(citeH + 8);
    const cy = doc.y;
    doc.roundedRect(M, cy, CW, citeH, 6).lineWidth(0.8).strokeColor(GOLD).stroke();
    eyebrow("How to cite this table", M + 14, cy + 10, GOLD_DEEP);
    doc.font("Times-Roman").fontSize(9.6).fillColor(INK).text(t(cite), M + 14, cy + 22, { width: CW - 28, lineGap: 1.5 });
    doc.y = cy + citeH + 8;

    // ── Per-page chrome ──────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    const generated = `${fmtDate(generatedAt)}, ${generatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      const pageNo = i - range.start + 1;

      if (pageNo > 1) {
        doc.font("Helvetica-Bold").fontSize(6.5).fillColor(GOLD_DEEP)
          .text(t(`SUPPLEMENTAL DATA  ·  ${tableLabel.toUpperCase()}  ·  ${article.title.toUpperCase()}`), M, 32, { width: CW - 120, characterSpacing: 1, lineBreak: false, ellipsis: true, height: 9 });
        doc.font("Helvetica").fontSize(7).fillColor(MUTED)
          .text(article.doi ? `doi:${article.doi}` : t(wl ? wl.name : J.shortName), M, 32, { width: CW, align: "right", lineBreak: false });
        doc.moveTo(M, 45).lineTo(M + CW, 45).lineWidth(0.5).strokeColor(RULE).stroke();
      }

      const fy = PAGE_H - 46;
      doc.moveTo(M, fy).lineTo(M + CW, fy).lineWidth(0.5).strokeColor(GOLD).stroke();
      doc.font("Helvetica-Bold").fontSize(6.6).fillColor(PURPLE)
        .text(t([...new Set([article.publisher || orgName, article.journalName])].join("  ·  ").toUpperCase()), M, fy + 7, { width: CW - 80, characterSpacing: 0.6, lineBreak: false, ellipsis: true, height: 9 });
      doc.font("Helvetica").fontSize(6.8).fillColor(MUTED).text(`Page ${pageNo} of ${range.count}`, M, fy + 7, { width: CW, align: "right", lineBreak: false });
      doc.font("Helvetica").fontSize(6.3).fillColor(MUTED)
        .text(t([issnLine ? `ISSN ${issnLine} (Online)` : null, J.license, wl ? wl.email : J.editorialEmail, `Generated ${generated}`].filter(Boolean).join("  ·  ")), M, fy + 17, { width: CW, lineBreak: false, ellipsis: true, height: 9 });

      doc.page.margins.bottom = savedBottom;
    }

    doc.end();
  });
}
