/**
 * PDF editions of the Official Forms, in the same PDFKit house style as the
 * guide PDFs (src/lib/guide-pdf.ts): purple/gold masthead cover with the
 * document-control panel, double hairline frame, faint diagonal watermark,
 * running header and controlled-document footer.
 *
 * Two editions from one definition:
 * - blank (/resources/forms/<slug>/pdf): a printable form with boxes,
 *   ruled answer spaces and a wet-ink signature block, every conditional
 *   question marked with when to answer it;
 * - signed record (/api/forms/records/<id>/pdf): the answers a person gave
 *   on the platform, only the questions they were shown, ticked boxes, and
 *   an electronic-signature panel with the record ID.
 */
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { ISSN_PENDING_LABEL, JOURNAL_IDENTITY } from "@/lib/site";
import { pdfSafe } from "@/lib/provenance-certificate-pdf";
import { darken } from "@/lib/guide-pdf";
import { fmtLongDate, guideById, guidePath } from "@/lib/resources";
import { PLATFORM_RESOURCE_BRAND, brandCode, type ResourceBrand } from "@/lib/resources/tenant-brand";
import { formCitation, formPath } from "@/lib/forms";
import { isFieldShown } from "@/lib/forms/validate";
import type { FormAnswers, FormField, ListedAuthorAnswer, OfficialFormDoc } from "@/lib/forms/types";

const INK = "#241b3a";
const BODY = "#2e2742";
const MUTED = "#6b6478";
const RULE = "#e4dfee";
const TINT = "#f7f4fc";
const BOX = "#b9aed3";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 58;
const CW = PAGE_W - 2 * M;
const TOP = 74;
const BOTTOM_MARGIN = 76;
const BOTTOM_LIMIT = PAGE_H - BOTTOM_MARGIN;

export interface SignedRecord {
  id: string;
  answers: FormAnswers;
  signedName: string;
  signedAt: Date;
  status: string;
  statusLabel: string;
  articleTitle?: string | null;
  decisionNote?: string | null;
  decidedAt?: Date | null;
}

export function formPdfFileName(f: OfficialFormDoc, brand: ResourceBrand = PLATFORM_RESOURCE_BRAND, record?: { id: string }): string {
  const owner = brand.whitelabel
    ? brand.shortName.normalize("NFKD").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 40) || "form"
    : "eleventh-press";
  const base = `${owner}-${f.code.toLowerCase()}-${f.slug}`;
  return record ? `${base}-signed-${record.id.slice(-8)}.pdf` : `${base}-v${f.version}.pdf`;
}

/** "Answer only if …" for a conditional question on the blank form. */
function conditionText(f: FormField, all: FormField[]): string | null {
  if (!f.showIf) return null;
  const parent = all.find((x) => x.id === f.showIf!.field);
  if (!parent) return null;
  const labels = (parent.options ?? []).filter((o) => f.showIf!.in.includes(o.value)).map((o) => `“${o.label.replace(/[,:].*$/, "")}”`);
  const q = parent.label.replace(/\s*\(.*?\)\s*$/, "").replace(/\?$/, "");
  return `Answer only if, for “${q}”, you chose ${labels.join(" or ")}.`;
}

export async function buildFormPdf(f: OfficialFormDoc, brand: ResourceBrand = PLATFORM_RESOURCE_BRAND, record?: SignedRecord): Promise<Buffer> {
  const APP_BASE_URL = brand.baseUrl;
  const PURPLE = brand.primaryHex;
  const PURPLE_DEEP = brand.whitelabel ? darken(brand.primaryHex, 0.42) : "#2a1458";
  const GOLD = brand.accentHex;
  const GOLD_DEEP = brand.whitelabel ? darken(brand.accentHex, 0.32) : "#8a6a28";
  const J = {
    name: brand.publisher,
    tagline: brand.whitelabel ? (brand.journalName !== brand.publisher ? brand.journalName : "Official publishing forms") : JOURNAL_IDENTITY.tagline,
    license: JOURNAL_IDENTITY.license,
    licenseUrl: JOURNAL_IDENTITY.licenseUrl,
  };
  const host = APP_BASE_URL.replace(/^https?:\/\//, "");
  const issnLine = brand.issn ? `ISSN ${brand.issn} (Online)` : brand.whitelabel ? null : ISSN_PENDING_LABEL;
  const contactLine = [issnLine, brand.location, brand.email, host].filter(Boolean).join("  ·  ");
  const onlineUrl = `${APP_BASE_URL}${formPath(f)}`;
  const qr = await QRCode.toBuffer(onlineUrl, { errorCorrectionLevel: "M", margin: 1, width: 240, color: { dark: INK, light: "#ffffff" } });
  const filled = !!record;
  const answers = record?.answers ?? {};
  const allFields = f.sections.flatMap((s) => s.fields);

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: TOP, bottom: BOTTOM_MARGIN, left: M, right: M },
      bufferPages: true,
      info: {
        Title: pdfSafe(`${f.title} (${f.code}, Version ${f.version})${filled ? " — signed record" : ""}`),
        Author: J.name,
        Subject: pdfSafe(f.summary),
        Keywords: pdfSafe([...f.keywords, ...f.benchmarks].join(", ")),
        Creator: `${J.name} — Editorial Office`,
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const t = (s: string) => pdfSafe(s.replace(/→/g, "›"));

    // ── Fillable fields (blank edition) ─────────────────────────────
    // AcroForm text fields, tick boxes and radio groups placed exactly over
    // the printed boxes, so the PDF can be completed in Acrobat, Preview or
    // a browser and still prints cleanly. Tick boxes and radio buttons carry
    // their own on/off appearance streams (PDFKit doesn't draw them), so the
    // ticks show in every viewer.
    const D = doc as any;
    let formFontId = "";
    let dingbatsId = "";
    if (!filled) {
      // ZapfDingbats in the form's resources, so a viewer that redraws a tick
      // box or radio button itself still draws a purple tick or dot.
      doc.font("ZapfDingbats");
      dingbatsId = D._font.id;
      const dingbatsRef = D._font.ref();
      doc.font("Helvetica");
      D.initForm();
      formFontId = D._font.id;
      // Viewers use the tick and dot appearances drawn below rather than
      // redrawing them from a font; text fields get their appearance from the
      // viewer as soon as someone types in them.
      D._root.data.AcroForm.data.NeedAppearances = false;
      // Registered under the conventional "ZaDb" key, which viewers look for.
      D._acroform.fonts.ZaDb = dingbatsRef;
      dingbatsId = "ZaDb";
    }
    const BTN_DA = () => new String(`/${dingbatsId} 7 Tf ${rgb(PURPLE)} rg`);
    const usedNames = new Set<string>();
    const fieldName = (n: string) => {
      const base = n.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 80) || "field";
      let k = base;
      for (let i = 2; usedNames.has(k); i++) k = `${base}_${i}`;
      usedNames.add(k);
      return k;
    };
    const rgb = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => (c / 255).toFixed(3)).join(" ");
    };
    const appearance = (w: number, h: number, ops: string) => {
      const r = D.ref({ Type: "XObject", Subtype: "Form", BBox: [0, 0, w, h], Resources: {} });
      r.write(ops);
      r.end();
      return r;
    };
    const circleOps = (cx: number, cy: number, r: number) => {
      const k = 0.5523 * r;
      return `${cx + r} ${cy} m ${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} c ${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} c ${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r} c ${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy} c`;
    };
    const lastAnnot = () => doc.page.annotations[doc.page.annotations.length - 1];
    const acroFields = () => D._root.data.AcroForm.data.Fields as unknown[];
    const pdfName = (v: string) => v.replace(/[^A-Za-z0-9_-]/g, "_") || "On";
    const TEXT_DA = () => new String(`/${formFontId} 9.5 Tf ${rgb(INK)} rg`);

    const fillCheckbox = (name: string, x: number, y: number, s = 9) => {
      if (filled) return;
      const on = appearance(s, s, `q ${rgb(PURPLE)} rg 0 0 ${s} ${s} re f 1 1 1 RG 1.4 w 1 J 1 j ${s * 0.22} ${s * 0.53} m ${s * 0.43} ${s * 0.27} l ${s * 0.8} ${s * 0.76} l S Q`);
      const off = appearance(s, s, "");
      doc.annotate(x, y, s, s, { Subtype: "Widget", FT: "Btn", T: new String(fieldName(name)), V: "Off", AS: "Off", AP: { N: { Yes: on, Off: off } }, DA: BTN_DA(), MK: { CA: new String("4") }, F: 4, C: [] } as any);
      acroFields().push(lastAnnot());
    };
    const radioGroups = new Map<string, any>();
    const fillRadio = (group: string, value: string, x: number, y: number, s = 9) => {
      if (filled) return;
      let parent = radioGroups.get(group);
      if (!parent) {
        parent = D.ref({ FT: "Btn", Ff: 49152, T: new String(fieldName(group)), V: "Off", Kids: [] });
        acroFields().push(parent);
        radioGroups.set(group, parent);
      }
      const v = pdfName(value);
      const on = appearance(s, s, `q ${rgb(PURPLE)} rg ${circleOps(s / 2, s / 2, s * 0.29)} f Q`);
      const off = appearance(s, s, "");
      doc.annotate(x, y, s, s, { Subtype: "Widget", Parent: parent, AS: "Off", AP: { N: { [v]: on, Off: off } }, DA: BTN_DA(), MK: { CA: new String("l") }, F: 4, C: [] } as any);
      parent.data.Kids.push(lastAnnot());
    };
    const fillText = (name: string, x: number, y: number, w: number, h: number, multiline: boolean) => {
      if (filled) return;
      // The form's default font, so PDFKit keeps this fixed 9.5 pt size
      // rather than switching the field to auto-size.
      doc.font("Helvetica");
      D.formText(fieldName(name), x, y, w, h, { multiline, DA: TEXT_DA() });
    };
    const newPage = () => {
      doc.addPage();
      doc.x = M;
      doc.y = TOP;
    };
    const ensure = (h: number) => {
      if (doc.y + h > BOTTOM_LIMIT) newPage();
    };
    const bodyFont = () => doc.font("Times-Roman").fontSize(10.4).fillColor(BODY);
    const paragraph = (text: string, gapAfter = 7) => {
      bodyFont();
      ensure(Math.min(doc.heightOfString(t(text), { width: CW, lineGap: 2.3 }), 40));
      doc.text(t(text), M, doc.y, { width: CW, align: "justify", lineGap: 2.3 });
      doc.y += gapAfter;
    };
    const bullet = (text: string) => {
      bodyFont();
      const h = doc.heightOfString(t(text), { width: CW - 18, lineGap: 2.2 });
      ensure(h + 4);
      const y = doc.y;
      doc.save().rect(M + 3, y + 4.6, 3.6, 3.6).fill(GOLD).restore();
      bodyFont();
      doc.text(t(text), M + 18, y, { width: CW - 18, lineGap: 2.2 });
      doc.y += 3.5;
    };
    let sectionNo = 0;
    const heading = (title: string, numbered = true) => {
      ensure(120);
      doc.y += 10;
      const y = doc.y;
      let tx = M;
      if (numbered) {
        sectionNo += 1;
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(GOLD_DEEP).text(`PART ${String(sectionNo)}`, M, y + 3.5, { lineBreak: false });
        tx = M + 40;
      }
      doc.font("Times-Bold").fontSize(14).fillColor(PURPLE).text(t(title), tx, y, { width: CW - (tx - M) });
      const ly = doc.y + 3;
      doc.moveTo(M, ly).lineTo(M + CW, ly).lineWidth(0.6).strokeColor(GOLD).stroke();
      doc.y = ly + 9;
      doc.x = M;
    };
    const label = (text: string, x: number, y: number, w: number, color = MUTED) =>
      doc.font("Helvetica-Bold").fontSize(6.4).fillColor(color).text(text.toUpperCase(), x, y, { width: w, characterSpacing: 1, lineBreak: false });

    /** A tick box at (x, y); ticked draws a check mark in it. */
    const tickBox = (x: number, y: number, ticked: boolean, round = false, fill?: { name: string; value?: string }) => {
      const s = 9;
      if (fill) {
        if (round) fillRadio(fill.name, fill.value ?? "On", x, y, s);
        else fillCheckbox(fill.value ? `${fill.name}_${fill.value}` : fill.name, x, y, s);
      }
      if (round) doc.circle(x + s / 2, y + s / 2, s / 2).lineWidth(0.9).strokeColor(PURPLE).stroke();
      else doc.roundedRect(x, y, s, s, 1.5).lineWidth(0.9).strokeColor(PURPLE).stroke();
      if (ticked) {
        if (round) doc.circle(x + s / 2, y + s / 2, 2.6).fill(PURPLE);
        else {
          doc.save().rect(x, y, s, s).fill(PURPLE).restore();
          doc.save().lineWidth(1.4).strokeColor("#ffffff").moveTo(x + 2, y + 4.8).lineTo(x + 3.9, y + 6.8).lineTo(x + 7.2, y + 2.4).stroke().restore();
        }
      }
    };

    // ── Field renderers ─────────────────────────────────────────────
    const fieldLabel = (fd: FormField, cond: string | null, required: boolean) => {
      doc.font("Helvetica-Bold").fontSize(8.8);
      const text = t(fd.label) + (required && !filled ? "  *" : "");
      const h = doc.heightOfString(text, { width: CW });
      ensure(h + 34);
      doc.fillColor(INK).text(text, M, doc.y, { width: CW });
      if (fd.help && !filled) {
        doc.font("Helvetica").fontSize(7.6).fillColor(MUTED).text(t(fd.help), M, doc.y + 1.5, { width: CW, lineGap: 1 });
      }
      if (cond) {
        doc.font("Helvetica-Oblique").fontSize(7.4).fillColor(GOLD_DEEP).text(t(cond), M, doc.y + 1.5, { width: CW });
      }
      doc.y += 4;
    };

    const valueBox = (value: string, minLines: number, name?: string) => {
      doc.font("Times-Roman").fontSize(10);
      const lineH = 15;
      const textH = value ? doc.heightOfString(t(value), { width: CW - 16, lineGap: 2 }) : 0;
      const h = Math.max(minLines * lineH + 8, textH + 12);
      if (doc.y + h > BOTTOM_LIMIT) newPage();
      const y = doc.y;
      if (value) {
        doc.roundedRect(M, y, CW, h, 3).fillAndStroke(TINT, RULE);
        doc.font("Times-Roman").fontSize(10).fillColor(INK).text(t(value), M + 8, y + 6, { width: CW - 16, lineGap: 2 });
      } else {
        doc.roundedRect(M, y, CW, h, 3).lineWidth(0.6).strokeColor(BOX).stroke();
        if (name) fillText(name, M + 2, y + 2, CW - 4, h - 4, minLines > 1);
        for (let i = 1; i < minLines; i++) {
          const ly = y + 4 + i * lineH;
          doc.moveTo(M + 8, ly).lineTo(M + CW - 8, ly).lineWidth(0.3).strokeColor(RULE).stroke();
        }
      }
      doc.y = y + h + 9;
    };

    const optionList = (fd: FormField, selected: string[], round: boolean, prefix = "") => {
      for (const o of fd.options ?? []) {
        if (filled && !selected.includes(o.value) && fd.type === "checkboxes") continue;
        doc.font("Times-Roman").fontSize(10);
        const h = doc.heightOfString(t(o.label), { width: CW - 22, lineGap: 1.5 });
        ensure(h + 5);
        const y = doc.y;
        tickBox(M + 2, y + 1, selected.includes(o.value), round, { name: `${prefix}${fd.id}`, value: o.value });
        doc.font(selected.includes(o.value) ? "Times-Bold" : "Times-Roman").fontSize(10).fillColor(filled && !selected.includes(o.value) ? MUTED : BODY).text(t(o.label), M + 20, y, { width: CW - 22, lineGap: 1.5 });
        doc.y += 3.5;
      }
      doc.y += 5;
    };

    const authorTable = (list: ListedAuthorAnswer[], name = "authors") => {
      const cols: [string, number][] = [["#", 20], ["Full name", 128], ["Email", 128], ["Affiliation", CW - 20 - 128 - 128 - 82], ["ORCID iD", 82]];
      const header = () => {
        ensure(40);
        const y = doc.y;
        doc.rect(M, y, CW, 17).fill(PURPLE);
        let x = M;
        for (const [k, w] of cols) {
          label(k, x + 5, y + 5.5, w - 8, "#ffffff");
          x += w;
        }
        doc.y = y + 17;
      };
      header();
      const rows = filled ? list : Array.from({ length: 6 }, () => null);
      rows.forEach((a, i) => {
        const cells = a ? [String(i + 1), a.name, a.email, a.affiliation ?? "", a.orcid ?? ""] : [String(i + 1), "", "", "", ""];
        doc.font("Helvetica").fontSize(8);
        const h = Math.max(22, ...cells.map((c, j) => doc.heightOfString(t(c), { width: cols[j][1] - 10 }) + 10));
        if (doc.y + h > BOTTOM_LIMIT) {
          newPage();
          header();
        }
        const y = doc.y;
        doc.rect(M, y, CW, h).fill(i % 2 === 0 ? "#ffffff" : TINT);
        let x = M;
        if (!a) {
          let fx = M;
          cols.forEach(([k, w], j) => {
            if (j > 0) fillText(`${name}_${i + 1}_${k}`, fx + 2, y + 2, w - 4, h - 4, false);
            fx += w;
          });
        }
        cells.forEach((c, j) => {
          doc.font(j === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(8).fillColor(j === 0 ? GOLD_DEEP : INK).text(t(c), x + 5, y + 6, { width: cols[j][1] - 10 });
          x += cols[j][1];
        });
        doc.moveTo(M, y + h).lineTo(M + CW, y + h).lineWidth(0.4).strokeColor(RULE).stroke();
        doc.y = y + h;
      });
      doc.y += 10;
    };

    const renderField = (fd: FormField, scope: Record<string, unknown>, fields: FormField[], prefix = "") => {
      if (filled && !isFieldShown(fd, scope)) return;
      const cond = filled ? null : conditionText(fd, fields);
      const v = scope[fd.id];
      switch (fd.type) {
        case "notice": {
          doc.font("Times-Roman").fontSize(9.8);
          const h = doc.heightOfString(t(fd.label), { width: CW - 24, lineGap: 1.8 }) + 14;
          ensure(h + 6);
          const y = doc.y;
          doc.rect(M, y, CW, h).fill(TINT);
          doc.rect(M, y, 2.5, h).fill(GOLD);
          const m = /^(\d+\.\s[^.]+\.)\s*([\s\S]*)$/.exec(fd.label);
          if (m) {
            doc.font("Times-Bold").fontSize(9.8).fillColor(INK).text(t(m[1]) + " ", M + 14, y + 7, { width: CW - 24, lineGap: 1.8, continued: true });
            doc.font("Times-Roman").fillColor(BODY).text(t(m[2]), { lineGap: 1.8 });
          } else {
            doc.font("Times-Roman").fontSize(9.8).fillColor(BODY).text(t(fd.label), M + 14, y + 7, { width: CW - 24, lineGap: 1.8 });
          }
          doc.y = y + h + 6;
          return;
        }
        case "attest": {
          doc.font("Times-Roman").fontSize(10.2);
          const h = doc.heightOfString(t(fd.label), { width: CW - 24, lineGap: 1.8 });
          const ch = cond ? 11 : 0;
          ensure(h + ch + 8);
          if (cond) {
            doc.font("Helvetica-Oblique").fontSize(7.4).fillColor(GOLD_DEEP).text(t(cond), M + 20, doc.y, { width: CW - 22 });
            doc.y += 1.5;
          }
          const y = doc.y;
          tickBox(M + 2, y + 1.5, v === true, false, { name: `${prefix}${fd.id}` });
          doc.font("Times-Roman").fontSize(10.2).fillColor(BODY).text(t(fd.label), M + 20, y, { width: CW - 22, lineGap: 1.8 });
          doc.y += 6;
          return;
        }
        case "radio":
        case "checkboxes":
          fieldLabel(fd, cond, !!fd.required);
          optionList(fd, Array.isArray(v) ? v.map(String) : typeof v === "string" ? [v] : [], fd.type === "radio", prefix);
          return;
        case "authorList":
          fieldLabel(fd, cond, !!fd.required);
          authorTable(Array.isArray(v) ? (v as ListedAuthorAnswer[]) : [], `${prefix}${fd.id}`);
          return;
        default: {
          fieldLabel(fd, cond, !!fd.required);
          const s = typeof v === "string" ? v : "";
          valueBox(filled ? s || "—" : "", fd.type === "textarea" ? 4 : 1, `${prefix}${fd.id}`);
        }
      }
    };

    // ── Cover ─────────────────────────────────────────────────────────
    const bandH = 290;
    doc.rect(0, 0, PAGE_W, bandH).fill(doc.linearGradient(0, 0, PAGE_W, bandH).stop(0, PURPLE_DEEP).stop(1, PURPLE));
    doc.rect(0, bandH, PAGE_W, 2.6).fill(GOLD);
    doc.save().opacity(0.14).lineWidth(0.8).strokeColor(GOLD);
    for (let r = 26; r <= 110; r += 14) doc.circle(PAGE_W - 70, 70, r).stroke();
    doc.restore();

    doc.font("Helvetica-Bold").fontSize(7.6).fillColor(GOLD).text(J.name.toUpperCase(), M, 46, { characterSpacing: 2.2, lineBreak: false });
    doc.font("Times-Italic").fontSize(9.4).fillColor("#d9cff0").text(J.tagline, M, 60, { lineBreak: false });

    const badge = `${filled ? "SIGNED RECORD" : "OFFICIAL FORM"}  ·  ${f.code}`;
    doc.font("Helvetica-Bold").fontSize(7.4);
    const badgeW = doc.widthOfString(badge, { characterSpacing: 1 }) + 22;
    doc.roundedRect(M, 104, badgeW, 20, 3).lineWidth(0.8).strokeColor(GOLD).stroke();
    doc.fillColor(GOLD).text(badge, M + 11, 110.5, { characterSpacing: 1, lineBreak: false });

    doc.font("Times-Bold").fontSize(28).fillColor("#ffffff").text(t(f.title), M, 140, { width: CW - 30, lineGap: 2 });
    doc.moveDown(0.35);
    doc.font("Helvetica").fontSize(9.6).fillColor("#e4dcf5").text(t(f.summary), M, doc.y, { width: CW - 40, lineGap: 2 });
    doc.font("Helvetica-Bold").fontSize(7).fillColor(GOLD).text(`FORM ${f.code}  ·  VERSION ${f.version}  ·  EFFECTIVE ${fmtLongDate(f.effective).toUpperCase()}`, M, bandH - 28, { characterSpacing: 1.2, lineBreak: false });

    const py = bandH + 24;
    doc.font("Helvetica-Bold").fontSize(7).fillColor(PURPLE).text(filled ? "RECORD" : "DOCUMENT CONTROL", M, py, { characterSpacing: 1.6, lineBreak: false });
    const rows: [string, string][] = filled
      ? [
          ["Form", `${f.code}, Version ${f.version}`],
          ["Record ID", record!.id],
          ["Signed by", record!.signedName],
          ["Signed on", record!.signedAt.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }) + " UTC"],
          ["Manuscript", record!.articleTitle || "Not applicable (applies to the signer)"],
          ["Status", record!.statusLabel],
        ]
      : [
          ["Document code", f.code],
          ["Version", `${f.version} (supersedes all earlier editions)`],
          ["Effective date", fmtLongDate(f.effective)],
          ["Next scheduled review", fmtLongDate(f.nextReview)],
          ["Completed by", f.audience],
          ["When", f.when],
          ["Where on the platform", f.where],
          ["Document owner", `Editorial Office, ${J.name}`],
        ];
    const colW = (CW - 18) / 2;
    let ry = py + 14;
    for (let i = 0; i < rows.length; i += 2) {
      const pair = rows.slice(i, i + 2);
      doc.font("Helvetica").fontSize(8.6);
      const h = Math.max(...pair.map(([, v]) => doc.heightOfString(t(v), { width: colW }))) + 17;
      pair.forEach(([k, v], j) => {
        const x = M + j * (colW + 18);
        label(k, x, ry, colW);
        doc.font("Helvetica").fontSize(8.6).fillColor(INK).text(t(v), x, ry + 9, { width: colW });
      });
      doc.moveTo(M, ry + h - 4).lineTo(M + CW, ry + h - 4).lineWidth(0.4).strokeColor(RULE).stroke();
      ry += h;
    }

    ry += 10;
    doc.font("Helvetica-Bold").fontSize(7).fillColor(PURPLE).text("BENCHMARKED AGAINST", M, ry, { characterSpacing: 1.6, lineBreak: false });
    ry += 14;
    let cx = M;
    for (const b of f.benchmarks) {
      doc.font("Helvetica-Bold").fontSize(7.6);
      const w = doc.widthOfString(t(b)) + 16;
      if (cx + w > M + CW) {
        cx = M;
        ry += 20;
      }
      doc.roundedRect(cx, ry, w, 15, 7.5).fillAndStroke(TINT, "#d8cdee");
      doc.font("Helvetica-Bold").fontSize(7.6).fillColor(PURPLE).text(t(b), cx + 8, ry + 4.2, { lineBreak: false });
      cx += w + 6;
    }

    const iy = PAGE_H - 200;
    ry += 30;
    const contents = f.sections
      .filter((s) => !filled || s.repeat === "authors" || s.fields.some((fd) => fd.type !== "notice" && isFieldShown(fd, answers)))
      .map((s, i) => [`${i + 1}`, s.heading] as [string, string]);
    contents.push(["", filled ? "Signature" : "Declaration and signature"]);
    contents[contents.length - 1][0] = String(contents.length);
    const cRows = Math.ceil(contents.length / 2);
    if (ry + 14 + cRows * 13 < iy - 12) {
      doc.font("Helvetica-Bold").fontSize(7).fillColor(PURPLE).text(filled ? "PARTS OF THIS RECORD" : "PARTS OF THIS FORM", M, ry, { characterSpacing: 1.6, lineBreak: false });
      ry += 14;
      contents.forEach(([num, c], i) => {
        const col = i < cRows ? 0 : 1;
        const row = col === 0 ? i : i - cRows;
        const x = M + col * (colW + 18);
        const y = ry + row * 13;
        doc.font("Helvetica-Bold").fontSize(7.2).fillColor(GOLD_DEEP).text(`PART ${num}`, x, y + 0.8, { width: 40, lineBreak: false });
        doc.font("Helvetica").fontSize(8.4).fillColor(INK).text(t(c), x + 40, y, { width: colW - 42, lineBreak: false });
      });
    }
    doc.roundedRect(M, iy, CW, 112, 6).fillAndStroke("#fbfaff", RULE);
    doc.rect(M, iy, 3, 112).fill(GOLD);
    doc.image(qr, M + CW - 96, iy + 12, { width: 86, height: 86 });
    const ix = M + 18;
    const iw = CW - 130;
    doc.font("Times-Bold").fontSize(12.5).fillColor(PURPLE).text(J.name, ix, iy + 14, { width: iw });
    doc.font("Helvetica").fontSize(8.2).fillColor(MUTED).text(J.tagline, ix, doc.y + 1, { width: iw });
    const idLines = [issnLine, brand.location, [brand.email, host].filter(Boolean).join("  ·  ")].filter((l): l is string => !!l);
    doc.font("Helvetica").fontSize(8.2).fillColor(INK);
    let ly = doc.y + 7;
    for (const line of idLines) {
      doc.text(line, ix, ly, { width: iw, lineBreak: false });
      ly += 12;
    }
    doc.font("Helvetica-Oblique").fontSize(7).fillColor(MUTED).text("Scan for the current online edition", M + CW - 110, iy + 100, { width: 114, align: "center", lineBreak: false });

    // ── Body ──────────────────────────────────────────────────────────
    newPage();
    if (!filled) {
      heading("About this form", false);
      label("Purpose", M, doc.y, CW, GOLD_DEEP);
      doc.y += 10;
      paragraph(f.purpose);
      label("Completed by", M, doc.y, CW, GOLD_DEEP);
      doc.y += 10;
      paragraph(`${f.audience}. ${f.when}`);
      label("On the platform", M, doc.y, CW, GOLD_DEEP);
      doc.y += 10;
      paragraph(`${f.where} Completing it on the platform is the official route; this printable edition is for reference, preparation and wet-ink signature where an author needs one.`, 4);

      heading("Instructions", false);
      for (let i = 0; i < f.instructions.length; i++) {
        bodyFont();
        const h = doc.heightOfString(t(f.instructions[i]), { width: CW - 40, lineGap: 2 }) + 9;
        ensure(h);
        const y = doc.y;
        doc.rect(M, y, CW, h).fill(i % 2 === 0 ? TINT : "#ffffff");
        doc.circle(M + 13, y + h / 2, 7.5).fill(PURPLE);
        doc.font("Helvetica-Bold").fontSize(7.4).fillColor("#ffffff").text(String(i + 1), M + 5.5, y + h / 2 - 3, { width: 15, align: "center", lineBreak: false });
        bodyFont();
        doc.text(t(f.instructions[i]), M + 30, y + 4.5, { width: CW - 40, lineGap: 2 });
        doc.y = y + h;
      }
      doc.rect(M, doc.y, CW, 1.4).fill(GOLD);
      doc.y += 6;
      doc.font("Helvetica").fontSize(7.4).fillColor(MUTED).text("Questions marked * must be answered when they apply. Tick every statement that you confirm.", M, doc.y + 4, { width: CW });
      doc.y += 8;
    } else if (record!.status !== "SUBMITTED") {
      heading("Status of this request", false);
      paragraph(`${record!.statusLabel}${record!.decidedAt ? ` on ${record!.decidedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}` : ""}.`);
      if (record!.decisionNote) paragraph(`Editor's explanation: ${record!.decisionNote}`);
    }

    // The form itself.
    for (const s of f.sections) {
      if (filled && s.repeat !== "authors" && !s.fields.some((fd) => fd.type !== "notice" && isFieldShown(fd, answers))) continue;
      heading(s.heading);
      if (s.repeat === "authors") {
        const list = filled ? ((answers.authors as Record<string, unknown>[] | undefined) ?? []) : Array.from({ length: 6 }, () => null);
        if (!filled) paragraph("Complete one block for each author. For more than six authors, complete a second copy of this form.", 6);
        list.forEach((row, i) => {
          ensure(120);
          const y = doc.y;
          doc.rect(M, y, CW, 20).fill(TINT);
          doc.rect(M, y, 2.5, 20).fill(GOLD);
          const name = row ? String(row.name ?? `Author ${i + 1}`) : "";
          doc.font("Helvetica-Bold").fontSize(8.4).fillColor(PURPLE).text(t(`AUTHOR ${i + 1}${name ? `  ·  ${name}` : ""}`), M + 12, y + 6.5, { width: CW - 24, characterSpacing: 0.6, lineBreak: false });
          doc.y = y + 28;
          if (!row) {
            doc.font("Helvetica-Bold").fontSize(8.8).fillColor(INK).text("Author's full name", M, doc.y);
            doc.y += 4;
            valueBox("", 1, `author${i + 1}_name`);
          }
          for (const fd of s.fields) renderField(fd, row ?? {}, s.fields, row ? "" : `author${i + 1}_`);
        });
      } else {
        if (s.intro) paragraph(s.intro, 6);
        for (const fd of s.fields) renderField(fd, answers, allFields);
      }
    }

    // Signature.
    heading(filled ? "Signature" : "Declaration and signature");
    paragraph(f.signatureStatement, 10);
    ensure(110);
    if (filled) {
      const y = doc.y;
      const h = 74;
      doc.roundedRect(M, y, CW, h, 5).fillAndStroke("#fbfaff", RULE);
      doc.rect(M, y, 3, h).fill(GOLD);
      label("Signed electronically by", M + 16, y + 12, 220, GOLD_DEEP);
      doc.font("Times-BoldItalic").fontSize(17).fillColor(PURPLE).text(t(record!.signedName), M + 16, y + 24, { width: CW / 2, lineBreak: false });
      label("Date and time (UTC)", M + CW / 2 + 10, y + 12, 200, GOLD_DEEP);
      doc.font("Helvetica").fontSize(9).fillColor(INK).text(record!.signedAt.toISOString().replace("T", " ").slice(0, 16), M + CW / 2 + 10, y + 26, { lineBreak: false });
      label("Record ID", M + CW / 2 + 10, y + 44, 200, GOLD_DEEP);
      doc.font("Courier").fontSize(8.4).fillColor(INK).text(record!.id, M + CW / 2 + 10, y + 56, { lineBreak: false });
      doc.font("Helvetica").fontSize(7).fillColor(MUTED).text("Signed by typing the full name above while signed in to the platform.", M + 16, y + 52, { width: CW / 2 - 20 });
      doc.y = y + h + 12;
    } else {
      const y = doc.y + 18;
      const w = (CW - 36) / 3;
      ["Full name", "Signature", "Date"].forEach((k, i) => {
        const x = M + i * (w + 18);
        doc.moveTo(x, y + 18).lineTo(x + w, y + 18).lineWidth(0.7).strokeColor(PURPLE).stroke();
        fillText(`signature_${k.replace(/\s+/g, "_").toLowerCase()}`, x, y, w, 17, false);
        label(k, x, y + 24, w);
      });
      doc.y = y + 48;
    }

    // Supporting matter.
    heading("What happens next", false);
    f.afterSubmission.forEach((a) => bullet(a));
    doc.y += 4;

    heading("Benchmarked standards and basis", false);
    paragraph("This form is benchmarked against the external standards below. “Aligned with” describes the standard each question follows; it is not a claim of membership in, or certification by, the issuing body.", 9);
    const c1 = 168;
    const c2 = 92;
    const c3 = CW - c1 - c2;
    const tableHeader = () => {
      const y = doc.y;
      doc.rect(M, y, CW, 18).fill(PURPLE);
      label("Standard and issuing body", M + 7, y + 6, c1 - 10, "#ffffff");
      label("Edition", M + c1 + 5, y + 6, c2 - 8, "#ffffff");
      label("How this form applies it", M + c1 + c2 + 5, y + 6, c3 - 10, "#ffffff");
      doc.y = y + 18;
    };
    ensure(60);
    tableHeader();
    f.standards.forEach((s, i) => {
      doc.font("Helvetica-Bold").fontSize(8.4);
      const h1 = doc.heightOfString(t(s.name), { width: c1 - 12 });
      doc.font("Helvetica").fontSize(7.6);
      const h1b = doc.heightOfString(t(s.issuer), { width: c1 - 12 });
      const h2 = doc.heightOfString(t(s.edition), { width: c2 - 10 });
      doc.font("Times-Roman").fontSize(9.2);
      const h3 = doc.heightOfString(t(s.application), { width: c3 - 12, lineGap: 1 });
      const h = Math.max(h1 + h1b + 4, h2, h3) + 12;
      if (doc.y + h > BOTTOM_LIMIT) {
        newPage();
        tableHeader();
      }
      const y = doc.y;
      doc.rect(M, y, CW, h).fill(i % 2 === 0 ? "#ffffff" : TINT);
      doc.font("Helvetica-Bold").fontSize(8.4).fillColor(INK).text(t(s.name), M + 7, y + 6, { width: c1 - 12, link: s.url });
      doc.font("Helvetica").fontSize(7.6).fillColor(MUTED).text(t(s.issuer), M + 7, doc.y + 1, { width: c1 - 12 });
      doc.font("Helvetica").fontSize(7.6).fillColor(INK).text(t(s.edition), M + c1 + 5, y + 6, { width: c2 - 10 });
      doc.font("Times-Roman").fontSize(9.2).fillColor(BODY).text(t(s.application), M + c1 + c2 + 5, y + 6, { width: c3 - 12, lineGap: 1 });
      doc.moveTo(M, y + h).lineTo(M + CW, y + h).lineWidth(0.4).strokeColor(RULE).stroke();
      doc.y = y + h;
    });
    doc.y += 6;
    doc.x = M;

    if (!filled) {
      heading("Frequently asked questions", false);
      for (const q of f.faqs) {
        doc.font("Times-Bold").fontSize(10.6);
        ensure(doc.heightOfString(t(q.q), { width: CW }) + 30);
        doc.fillColor(INK).text(t(q.q), M, doc.y, { width: CW });
        doc.y += 2;
        paragraph(q.a, 9);
      }
    }

    heading("Related guides and how to cite this form", false);
    for (const r of f.relatedGuides.map(guideById).filter((x): x is NonNullable<typeof x> => !!x)) {
      ensure(30);
      const y = doc.y;
      doc.save().rect(M + 3, y + 4.6, 3.6, 3.6).fill(GOLD).restore();
      doc.font("Times-Bold").fontSize(10.2).fillColor(INK).text(t(`${brandCode(r.code, brand)} — ${r.title}`), M + 18, y, { width: CW - 18 });
      const url = `${APP_BASE_URL}${guidePath(r)}`;
      doc.font("Helvetica").fontSize(7.8).fillColor(PURPLE).text(url, M + 18, doc.y + 1, { width: CW - 18, link: url });
      doc.y += 5;
    }
    doc.y += 6;
    const cite = t(formCitation(f, brand));
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
        filled
          ? `This PDF is a copy of a form signed on the platform. The platform record ${record!.id} is authoritative.${brand.email ? ` Questions: ${brand.email}.` : ""}`
          : `This PDF is the official printable edition of ${f.code}, Version ${f.version}. The online edition at ${onlineUrl} is authoritative and is updated whenever the form is revised.${brand.email ? ` Questions about this form: ${brand.email}.` : ""} © ${f.effective.slice(0, 4)} ${J.name}. Licensed under ${J.license} (${J.licenseUrl}).`
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
        const wm = filled ? `${J.name} · SIGNED RECORD` : J.name;
        const wmW = doc.widthOfString(wm, { characterSpacing: 1 });
        doc.text(wm, PAGE_W / 2 - wmW / 2, PAGE_H / 2 - 14, { lineBreak: false, characterSpacing: 1 });
        doc.restore();

        doc.font("Helvetica-Bold").fontSize(6.5).fillColor(GOLD_DEEP)
          .text(t(`${filled ? "SIGNED RECORD" : "OFFICIAL FORM"}  ·  ${f.title.toUpperCase()}`), M, 38, { width: CW - 90, characterSpacing: 1.2, lineBreak: false });
        doc.font("Helvetica").fontSize(7).fillColor(MUTED).text(`${f.code}  ·  v${f.version}`, M, 38, { width: CW, align: "right", lineBreak: false });
        doc.moveTo(M, 51).lineTo(M + CW, 51).lineWidth(0.5).strokeColor(RULE).stroke();
      }

      const fy = PAGE_H - 52;
      doc.moveTo(M, fy).lineTo(M + CW, fy).lineWidth(0.5).strokeColor(GOLD).stroke();
      doc.font("Helvetica-Bold").fontSize(6.6).fillColor(PURPLE)
        .text(`${J.name.toUpperCase()}  ·  ${f.code}  ·  VERSION ${f.version}${filled ? `  ·  RECORD ${record!.id.slice(-10).toUpperCase()}` : ""}`, M, fy + 7, { characterSpacing: 0.8, lineBreak: false });
      doc.font("Helvetica").fontSize(6.8).fillColor(MUTED).text(`Page ${pageNo} of ${range.count}`, M, fy + 7, { width: CW, align: "right", lineBreak: false });
      doc.font("Helvetica").fontSize(6.4).fillColor(MUTED).text(contactLine, M, fy + 17, { width: CW, lineBreak: false });

      doc.page.margins.bottom = savedBottom;
    }

    doc.end();
  });
}
