/**
 * Renderers for an article's research visuals (content: src/lib/research-visuals.ts):
 *
 * - Research infographic: a tall single-page portrait summary.
 * - Research poster: ISO A0 portrait (841 × 1189 mm), conference-ready,
 *   three-column, prints sharply at A0 or scales down to A1/A2.
 * - Graphical abstract: a wide 2.5:1 single page (the ratio journals ask for).
 * - Theoretical framework / conceptual paradigm: A4 landscape. It is redrawn
 *   from the framework the article describes, followed by the article's
 *   own framework figure(s) exactly as published.
 *
 * Every document carries the publisher's identity. A whitelabel tenant's
 * documents use its name, logo, colours and contact details, never Eleventh
 * Press's ISSN, and carry the fixed platform credit. They use the same
 * PDFKit family and standard fonts as the galley, data-table and certificate
 * PDFs, so they run on Vercel's serverless runtime.
 */
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { paletteFor, pdfSafe } from "@/lib/provenance-certificate-pdf";
import { POWERED_BY_CREDIT } from "@/lib/powered-by";
import { formatCitation, parseAuthors } from "@/lib/article";
import type { ConstructRole, FrameworkConstruct, ResearchFramework, ResearchVisualContent } from "@/lib/research-visuals";

type Doc = PDFKit.PDFDocument;

export type ResearchVisualKind = "infographic" | "poster" | "graphical-abstract" | "framework";

export const RESEARCH_VISUAL_KINDS: ResearchVisualKind[] = ["infographic", "poster", "graphical-abstract", "framework"];

export const RESEARCH_VISUAL_LABELS: Record<ResearchVisualKind, string> = {
  infographic: "Research Infographic",
  poster: "Research Poster",
  "graphical-abstract": "Graphical Abstract",
  framework: "Theoretical Framework",
};

export interface VisualBrand {
  whitelabel: boolean;
  orgName: string;
  journalName: string;
  issn?: string | null;
  eissn?: string | null;
  tagline?: string | null;
  email?: string | null;
  primaryHex?: string | null;
  accentHex?: string | null;
  logoPng?: Buffer | null;
}

export interface VisualArticle {
  id: string;
  title: string;
  /** JSON-stringified ArticleAuthor[]. */
  authors: string;
  doi?: string | null;
  publishedAt?: Date | string | null;
  keywords?: string | null;
  discipline?: string | null;
  contentType?: string | null;
  volume?: number | null;
  issueNumber?: number | null;
  year?: number | null;
  articleUrl: string;
  /** Reference list entries as published (poster prints the first few). */
  references?: string[];
}

export interface VisualFigure {
  number: string;
  caption: string;
  png: Buffer;
  width: number;
  height: number;
  isFramework: boolean;
}

export interface VisualInput {
  article: VisualArticle;
  brand: VisualBrand;
  content: ResearchVisualContent;
  figures?: VisualFigure[];
  generatedAt?: Date;
}

// ─── Colour ────────────────────────────────────────────────────────────────

const INK = "#1f1933";
const BODY = "#2e2742";
const MUTED = "#6b6478";
const RULE = "#e4dfee";
const WHITE = "#ffffff";

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Readable text colour on a fill. */
function onColor(fill: string): string {
  return luminance(fill) > 0.42 ? INK : WHITE;
}

/** A darker shade of a colour that is readable as text on white. */
function inkOf(hex: string): string {
  let c = hex;
  for (let i = 0; i < 6 && luminance(c) > 0.18; i++) c = mix(c, "#000000", 0.18);
  return c;
}

interface Pal {
  p: string; // primary
  pd: string; // primary deep
  a: string; // accent
  ad: string; // accent deep
  pInk: string; // primary as text on white
  aInk: string; // accent as text on white
  tint: string; // very light primary
  tint2: string; // light accent
  onP: string;
  onPd: string;
  onA: string;
}

function palette(brand: VisualBrand): Pal {
  const base = paletteFor(brand.whitelabel ? { whitelabel: true, primaryHex: brand.primaryHex, accentHex: brand.accentHex } : null);
  const p = base.purple;
  const pd = base.purpleDeep;
  const a = base.gold;
  const ad = base.goldDeep;
  return {
    p, pd, a, ad,
    pInk: inkOf(p),
    aInk: inkOf(ad),
    tint: mix(p, WHITE, 0.93),
    tint2: mix(a, WHITE, 0.84),
    onP: onColor(p),
    onPd: onColor(pd),
    onA: onColor(a),
  };
}

// ─── Text + drawing helpers ────────────────────────────────────────────────

// Statistical notation the standard (WinAnsi) fonts cannot draw is spelled out instead of printing "?".
const SYMBOLS: Record<string, string> = {
  "α": "alpha", "β": "beta", "γ": "gamma", "δ": "delta", "Δ": "Delta", "η": "eta", "θ": "theta", "κ": "kappa", "λ": "lambda",
  "ρ": "rho", "σ": "sigma", "τ": "tau", "φ": "phi", "χ": "chi", "ψ": "psi", "ω": "omega", "Ω": "Omega",
  "≤": "<=", "≥": ">=", "≈": "~", "≠": "!=", "−": "-", "→": "->", "√": "sqrt",
};
const T = (s: string | null | undefined) => pdfSafe((s ?? "").replace(/[αβγδΔηθκλρσςτφχψωΩ≤≥≈≠−→√]/g, (ch) => SYMBOLS[ch] ?? (ch === "ς" ? "sigma" : ch)));

const F = {
  sans: "Helvetica",
  bold: "Helvetica-Bold",
  oblique: "Helvetica-Oblique",
  serif: "Times-Roman",
  serifBold: "Times-Bold",
  serifItalic: "Times-Italic",
};

function textH(doc: Doc, s: string, font: string, size: number, width: number, lineGap = 0): number {
  if (!s) return 0;
  doc.font(font).fontSize(size);
  return doc.heightOfString(T(s), { width, lineGap });
}

/** Largest font size (max→min) at which `s` fits in width × maxH. */
function fit(doc: Doc, s: string, font: string, max: number, min: number, width: number, maxH: number, lineGapRatio = 0.15): number {
  for (let size = max; size > min; size -= 0.5) {
    if (textH(doc, s, font, size, width, size * lineGapRatio) <= maxH) return size;
  }
  return min;
}

function write(
  doc: Doc,
  s: string,
  x: number,
  y: number,
  o: { font?: string; size: number; color?: string; width: number; align?: "left" | "center" | "right" | "justify"; lineGap?: number; height?: number; spacing?: number }
): number {
  if (!s) return 0;
  doc.font(o.font ?? F.sans).fontSize(o.size).fillColor(o.color ?? BODY);
  const opts: PDFKit.Mixins.TextOptions = { width: o.width, align: o.align ?? "left", lineGap: o.lineGap ?? o.size * 0.15 };
  if (o.spacing) opts.characterSpacing = o.spacing;
  if (o.height) {
    opts.height = o.height;
    opts.ellipsis = true;
  }
  const h = Math.min(doc.heightOfString(T(s), opts), o.height ?? Infinity);
  doc.text(T(s), x, y, opts);
  return h;
}

function eyebrow(doc: Doc, s: string, x: number, y: number, size: number, color: string, width = 2000): number {
  doc.font(F.bold).fontSize(size).fillColor(color).text(T(s).toUpperCase(), x, y, { characterSpacing: size * 0.18, lineBreak: false, width, ellipsis: true });
  return size * 1.2;
}

type IconKind = "search" | "target" | "methods" | "users" | "pin" | "doc" | "chart" | "bulb" | "check" | "alert" | "book" | "network" | "question" | "number";

/** A filled circle with a simple vector glyph — no icon fonts needed. */
function icon(doc: Doc, kind: IconKind, cx: number, cy: number, r: number, fill: string, glyph = onColor(fill), label?: string) {
  doc.save();
  doc.circle(cx, cy, r).fill(fill);
  const s = r * 0.62;
  doc.lineWidth(Math.max(0.8, r * 0.1)).strokeColor(glyph).fillColor(glyph).lineCap("round").lineJoin("round");
  switch (kind) {
    case "search":
      doc.circle(cx - s * 0.18, cy - s * 0.18, s * 0.5).stroke();
      doc.moveTo(cx + s * 0.18, cy + s * 0.18).lineTo(cx + s * 0.68, cy + s * 0.68).stroke();
      break;
    case "target":
      doc.circle(cx, cy, s * 0.82).stroke();
      doc.circle(cx, cy, s * 0.46).stroke();
      doc.circle(cx, cy, s * 0.14).fill();
      break;
    case "methods":
      doc.roundedRect(cx - s * 0.6, cy - s * 0.72, s * 1.2, s * 1.5, s * 0.12).stroke();
      [-0.25, 0.1, 0.45].forEach((dy) => doc.moveTo(cx - s * 0.32, cy + s * dy).lineTo(cx + s * 0.32, cy + s * dy).stroke());
      doc.rect(cx - s * 0.28, cy - s * 0.88, s * 0.56, s * 0.3).fill();
      break;
    case "users":
      doc.circle(cx - s * 0.35, cy - s * 0.3, s * 0.27).fill();
      doc.circle(cx + s * 0.38, cy - s * 0.3, s * 0.27).fill();
      doc.roundedRect(cx - s * 0.8, cy + s * 0.08, s * 0.9, s * 0.6, s * 0.28).fill();
      doc.roundedRect(cx - 0.05 * s, cy + s * 0.08, s * 0.9, s * 0.6, s * 0.28).fill();
      break;
    case "pin":
      doc.circle(cx, cy - s * 0.22, s * 0.48).fill();
      doc.moveTo(cx - s * 0.42, cy - s * 0.02).lineTo(cx, cy + s * 0.82).lineTo(cx + s * 0.42, cy - s * 0.02).fill();
      doc.circle(cx, cy - s * 0.22, s * 0.18).fill(onColor(glyph));
      break;
    case "doc":
      doc.moveTo(cx - s * 0.55, cy - s * 0.8).lineTo(cx + s * 0.25, cy - s * 0.8).lineTo(cx + s * 0.55, cy - s * 0.5).lineTo(cx + s * 0.55, cy + s * 0.8).lineTo(cx - s * 0.55, cy + s * 0.8).closePath().stroke();
      [-0.2, 0.15, 0.48].forEach((dy) => doc.moveTo(cx - s * 0.3, cy + s * dy).lineTo(cx + s * 0.3, cy + s * dy).stroke());
      break;
    case "chart":
      doc.rect(cx - s * 0.7, cy + s * 0.05, s * 0.36, s * 0.7).fill();
      doc.rect(cx - s * 0.18, cy - s * 0.35, s * 0.36, s * 1.1).fill();
      doc.rect(cx + s * 0.34, cy - s * 0.75, s * 0.36, s * 1.5).fill();
      break;
    case "bulb":
      doc.circle(cx, cy - s * 0.2, s * 0.55).fill();
      doc.rect(cx - s * 0.28, cy + s * 0.32, s * 0.56, s * 0.22).fill();
      doc.rect(cx - s * 0.22, cy + s * 0.6, s * 0.44, s * 0.14).fill();
      break;
    case "check":
      doc.lineWidth(Math.max(1, r * 0.16)).moveTo(cx - s * 0.55, cy + s * 0.02).lineTo(cx - s * 0.12, cy + s * 0.45).lineTo(cx + s * 0.62, cy - s * 0.42).stroke();
      break;
    case "alert":
      doc.moveTo(cx, cy - s * 0.8).lineTo(cx + s * 0.8, cy + s * 0.65).lineTo(cx - s * 0.8, cy + s * 0.65).closePath().stroke();
      doc.moveTo(cx, cy - s * 0.25).lineTo(cx, cy + s * 0.18).stroke();
      doc.circle(cx, cy + s * 0.42, s * 0.06).fill();
      break;
    case "book":
      doc.moveTo(cx, cy - s * 0.5).lineTo(cx - s * 0.75, cy - s * 0.7).lineTo(cx - s * 0.75, cy + s * 0.6).lineTo(cx, cy + s * 0.78).lineTo(cx + s * 0.75, cy + s * 0.6).lineTo(cx + s * 0.75, cy - s * 0.7).closePath().stroke();
      doc.moveTo(cx, cy - s * 0.5).lineTo(cx, cy + s * 0.78).stroke();
      break;
    case "network":
      doc.moveTo(cx - s * 0.55, cy + s * 0.45).lineTo(cx, cy - s * 0.5).lineTo(cx + s * 0.55, cy + s * 0.45).lineTo(cx - s * 0.55, cy + s * 0.45).stroke();
      doc.circle(cx, cy - s * 0.5, s * 0.24).fill();
      doc.circle(cx - s * 0.55, cy + s * 0.45, s * 0.24).fill();
      doc.circle(cx + s * 0.55, cy + s * 0.45, s * 0.24).fill();
      break;
    case "question":
    case "number": {
      const txt = label ?? "?";
      const size = r * (txt.length > 1 ? 0.95 : 1.15);
      doc.font(F.bold).fontSize(size);
      const w = doc.widthOfString(txt);
      doc.fillColor(glyph).text(txt, cx - w / 2, cy - size * 0.36, { lineBreak: false });
      break;
    }
  }
  doc.restore();
}

/** A rounded card with an optional coloured top rule. */
function card(doc: Doc, x: number, y: number, w: number, h: number, pal: Pal, o: { fill?: string; stroke?: string; topRule?: string; radius?: number } = {}) {
  const r = o.radius ?? 10;
  doc.save();
  doc.roundedRect(x, y, w, h, r).fill(o.fill ?? WHITE);
  doc.roundedRect(x, y, w, h, r).lineWidth(0.8).strokeColor(o.stroke ?? RULE).stroke();
  if (o.topRule) {
    doc.roundedRect(x, y, w, Math.min(r * 2, h), r).clip();
    doc.rect(x, y, w, 4).fill(o.topRule);
  }
  doc.restore();
}

function arrowHead(doc: Doc, x: number, y: number, angle: number, size: number, color: string) {
  const a1 = angle + Math.PI * 0.84;
  const a2 = angle - Math.PI * 0.84;
  doc.save().fillColor(color)
    .moveTo(x, y)
    .lineTo(x + size * Math.cos(a1), y + size * Math.sin(a1))
    .lineTo(x + size * Math.cos(a2), y + size * Math.sin(a2))
    .closePath().fill().restore();
}

function arrow(doc: Doc, x1: number, y1: number, x2: number, y2: number, color: string, width: number, head: number, dashed = false) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const ex = x2 - Math.cos(ang) * head * 0.8;
  const ey = y2 - Math.sin(ang) * head * 0.8;
  doc.save().lineWidth(width).strokeColor(color).lineCap("round");
  if (dashed) doc.dash(width * 3, { space: width * 2.5 });
  doc.moveTo(x1, y1).lineTo(ex, ey).stroke();
  doc.undash().restore();
  arrowHead(doc, x2, y2, ang, head, color);
}

/** A broad chevron arrow used between panels. */
function chevron(doc: Doc, cx: number, cy: number, w: number, h: number, color: string) {
  doc.save().fillColor(color)
    .moveTo(cx - w / 2, cy - h / 2)
    .lineTo(cx + w * 0.1, cy - h / 2)
    .lineTo(cx + w / 2, cy)
    .lineTo(cx + w * 0.1, cy + h / 2)
    .lineTo(cx - w / 2, cy + h / 2)
    .lineTo(cx - w * 0.1, cy)
    .closePath().fill().restore();
}

function newDoc(width: number, height: number, info: PDFKit.DocumentInfo): Doc {
  return new PDFDocument({ size: [width, height], margins: { top: 0, bottom: 0, left: 0, right: 0 }, autoFirstPage: true, info });
}

/** A scratch document for measuring heights before laying out. */
function probe(width: number): Doc {
  return new PDFDocument({ size: [width, 14000], margins: { top: 0, bottom: 0, left: 0, right: 0 } });
}

function finish(doc: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function docInfo(input: VisualInput, kind: ResearchVisualKind): PDFKit.DocumentInfo {
  const authors = parseAuthors(input.article.authors).map((a) => a.name).join(", ");
  return {
    Title: T(`${RESEARCH_VISUAL_LABELS[kind]} — ${input.article.title}`),
    Author: T(authors || input.brand.orgName),
    Subject: T(`${RESEARCH_VISUAL_LABELS[kind]} of "${input.article.title}", ${input.brand.journalName}`),
    Keywords: T(input.article.keywords ?? ""),
    Creator: T(`${input.brand.orgName} — Research Visuals`),
    Producer: T(input.brand.orgName),
  };
}

// ─── Shared article details ───────────────────────────────────────────────

function authorLine(raw: string, max = 8): string {
  const names = parseAuthors(raw).map((a) => a.name.trim()).filter(Boolean);
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} et al.`;
}

function affiliations(raw: string): { authors: { name: string; marks: number[] }[]; affs: string[] } {
  const list = parseAuthors(raw);
  const affs: string[] = [];
  const authors = list.map((a) => {
    const aff = (a.affiliation ?? "").trim();
    let marks: number[] = [];
    if (aff) {
      let i = affs.indexOf(aff);
      if (i < 0) {
        affs.push(aff);
        i = affs.length - 1;
      }
      marks = [i + 1];
    }
    return { name: a.name.trim(), marks };
  });
  return { authors, affs };
}

function pubYear(a: VisualArticle): number | null {
  return a.publishedAt ? new Date(a.publishedAt).getUTCFullYear() : a.year ?? null;
}

function metaLine(input: VisualInput): string {
  const a = input.article;
  const vol = a.volume ? `Vol. ${a.volume}${a.issueNumber ? `(${a.issueNumber})` : ""}` : "";
  return [input.brand.journalName, vol, pubYear(a) ? String(pubYear(a)) : "", a.doi ? `https://doi.org/${a.doi}` : ""].filter(Boolean).join("  ·  ");
}

function citation(input: VisualInput): string {
  const a = input.article;
  return formatCitation({
    title: a.title,
    authors: a.authors,
    publishedAt: a.publishedAt,
    doi: a.doi,
    journalName: input.brand.journalName,
    volume: a.volume,
    issueNumber: a.issueNumber,
    year: a.year,
  });
}

function issnLine(b: VisualBrand): string {
  const parts: string[] = [];
  if (b.issn) parts.push(`ISSN ${b.issn}`);
  if (b.eissn) parts.push(`e-ISSN ${b.eissn}`);
  return parts.join("  ·  ");
}

async function qrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, { errorCorrectionLevel: "M", margin: 1, width: 600, color: { dark: INK, light: "#ffffff" } });
}

/**
 * The uploaded logo, unaltered, on a white rounded tile so it reads on any
 * colour band. The tile follows the logo's own proportions (a wide wordmark
 * gets a wide tile, up to `maxAspect` × height) so the artwork is never
 * squeezed or shrunk into a square. Returns the tile width (0 = no logo).
 */
function logoTile(doc: Doc, png: Buffer | null | undefined, x: number, y: number, size: number, maxAspect = 1): number {
  if (!png) return 0;
  try {
    const img = (doc as any).openImage(png) as { width: number; height: number };
    const pad = size * 0.1;
    const aspect = img.width / Math.max(1, img.height);
    const tileW = Math.max(size, Math.min(size * maxAspect, (size - 2 * pad) * aspect + 2 * pad));
    doc.save().roundedRect(x, y, tileW, size, size * 0.16).fill(WHITE).restore();
    doc.image(img as any, x + pad, y + pad, { fit: [tileW - 2 * pad, size - 2 * pad], align: "center", valign: "center" });
    return tileW;
  } catch {
    return 0;
  }
}

/** The org monogram used when there is no logo (platform or tenant). */
function monogram(doc: Doc, name: string, x: number, y: number, size: number, pal: Pal) {
  const letters = name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "J";
  doc.save().roundedRect(x, y, size, size, size * 0.16).fill(pal.a).restore();
  doc.font(F.serifBold).fontSize(size * 0.46);
  const w = doc.widthOfString(letters);
  doc.fillColor(pal.onA).text(letters, x + (size - w) / 2, y + size * 0.26, { lineBreak: false });
}

/**
 * The platform's own mark, drawn exactly as the site header shows it (the
 * ".wax-mark" medallion in globals.css): a royal-purple radial disc with a
 * thin gold double ring and the gold serif "EP" monogram.
 */
function platformSeal(doc: Doc, x: number, y: number, size: number) {
  const r = size / 2;
  const cx = x + r;
  const cy = y + r;
  doc.save();
  doc.circle(cx, cy, r).fill("#a2650a"); // --gold-600 outer ring
  doc.circle(cx, cy, r * 0.965).fill("#efc880"); // --gold-300 inner ring
  doc.circle(cx, cy, r * 0.93).fill(
    doc
      .radialGradient(x + size * 0.32, y + size * 0.26, 0, x + size * 0.32, y + size * 0.26, r * 1.55)
      .stop(0, "#b5a3f0") // --royal-300
      .stop(0.46, "#6f44bc") // --royal-500
      .stop(0.8, "#461e86") // --royal-700
      .stop(1, "#221049") // --royal-900
  );
  doc.restore();
  doc.font(F.serifBold).fontSize(size * 0.38);
  const w = doc.widthOfString("EP");
  const ty = cy - size * 0.38 * 0.36;
  doc.fillColor("#221049").fillOpacity(0.45).text("EP", cx - w / 2, ty + size * 0.02, { lineBreak: false });
  doc.fillOpacity(1);
  doc.fill(doc.linearGradient(cx - w / 2, ty, cx + w / 2, ty + size * 0.38).stop(0.15, "#fae6bb").stop(0.55, "#c78b28").stop(1, "#a2650a"));
  doc.text("EP", cx - w / 2, ty, { lineBreak: false });
}

/**
 * The publisher's exact logo: the uploaded logo of the tenant (or of the
 * platform, if one is set); otherwise the platform's own "EP" medallion.
 * A tenant with no uploaded logo has no logo to reproduce, so its initials
 * are shown in its own colours (never the platform's mark).
 */
function brandMark(doc: Doc, input: VisualInput, pal: Pal, x: number, y: number, size: number, maxAspect = 1): number {
  const w = logoTile(doc, input.brand.logoPng, x, y, size, maxAspect);
  if (w) return w;
  if (!input.brand.whitelabel) platformSeal(doc, x, y, size);
  else monogram(doc, input.brand.orgName, x, y, size, pal);
  return size;
}

const FOOTNOTE =
  "Content drawn from the published article; numbers are checked against the article text. Read the full article for complete methods and results.";

// ─── Framework diagram (shared by the framework PDF, poster and infographic) ─

const ROLE_ORDER: Record<ConstructRole, number> = {
  independent: 0, control: 0, input: 0, theory: 0, concept: 1,
  mediator: 1, process: 1, moderator: 1,
  dependent: 2, output: 2,
};

export const ROLE_LABEL: Record<ConstructRole, string> = {
  independent: "Independent variable",
  mediator: "Mediating variable",
  moderator: "Moderating variable",
  dependent: "Dependent variable",
  control: "Control variable",
  input: "Input",
  process: "Process",
  output: "Output",
  theory: "Theory",
  concept: "Concept",
};

function roleColor(role: ConstructRole, pal: Pal): string {
  switch (role) {
    case "independent":
    case "input":
    case "theory":
      return pal.p;
    case "mediator":
    case "process":
    case "concept":
      return mix(pal.p, pal.ad, 0.5);
    case "moderator":
      return pal.ad;
    case "dependent":
    case "output":
      return pal.pd;
    case "control":
      return "#5b5568";
  }
}

interface Box {
  c: FrameworkConstruct;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Draws the framework into a region and returns the height used. Pass
 * `draw: false` to measure only.
 */
export function drawFramework(doc: Doc, fw: ResearchFramework, pal: Pal, x: number, y: number, w: number, s: number, draw = true, studyLabel = "This study"): number {
  const pad = 10 * s;
  const labelSize = 11 * s;
  const itemSize = 8.6 * s;
  const headSize = 6.6 * s;
  let used = 0;

  const boxHeight = (c: FrameworkConstruct, bw: number) => {
    let h = pad + headSize * 1.4 + textH(doc, c.label, F.bold, labelSize, bw - 2 * pad, labelSize * 0.12);
    if (c.items.length) h += pad * 0.5 + textH(doc, c.items.join("  \u2022  "), F.sans, itemSize, bw - 2 * pad, itemSize * 0.2);
    return h + pad;
  };
  const drawBox = (b: Box) => {
    if (!draw) return;
    const col = roleColor(b.c.role, pal);
    doc.save();
    doc.roundedRect(b.x, b.y, b.w, b.h, 8 * s).fill(WHITE);
    doc.roundedRect(b.x, b.y, b.w, b.h, 8 * s).lineWidth(1.4 * s).strokeColor(col).stroke();
    doc.roundedRect(b.x, b.y, b.w, b.h, 8 * s).clip();
    doc.rect(b.x, b.y, 5 * s, b.h).fill(col);
    doc.restore();
    let cy = b.y + pad;
    eyebrow(doc, ROLE_LABEL[b.c.role], b.x + pad, cy, headSize, inkOf(col), b.w - 2 * pad);
    cy += headSize * 1.4;
    cy += write(doc, b.c.label, b.x + pad, cy, { font: F.bold, size: labelSize, color: INK, width: b.w - 2 * pad, lineGap: labelSize * 0.12 });
    if (b.c.items.length) {
      cy += pad * 0.5;
      write(doc, b.c.items.join("  \u2022  "), b.x + pad, cy, { size: itemSize, color: BODY, width: b.w - 2 * pad, lineGap: itemSize * 0.2 });
    }
  };
  const pill = (label: string, cx: number, cy: number) => {
    if (!draw || !label) return;
    doc.font(F.bold).fontSize(7.4 * s);
    const tw = doc.widthOfString(T(label));
    const ph = 13 * s;
    doc.save().roundedRect(cx - tw / 2 - 6 * s, cy - ph / 2, tw + 12 * s, ph, ph / 2).fill(pal.a).restore();
    doc.fillColor(pal.onA).text(T(label), cx - tw / 2, cy - 7.4 * s * 0.38, { lineBreak: false });
  };

  // Theories strip (all layouts but "theory", where they are the diagram).
  if (fw.layout !== "theory" && fw.layout !== "none" && fw.theories.length) {
    const label = "Anchored on";
    doc.font(F.bold).fontSize(7 * s);
    const lw = doc.widthOfString(label.toUpperCase(), { characterSpacing: 7 * s * 0.18 }) + 22 * s;
    const tw = w - lw;
    const text = fw.theories.map((t) => (t.note ? `${t.name} (${t.note})` : t.name)).join("   •   ");
    const th = textH(doc, text, F.sans, 9 * s, tw - 16 * s, 9 * s * 0.15) + 14 * s;
    if (draw) {
      doc.save().roundedRect(x, y, w, th, 7 * s).fill(pal.tint2).restore();
      eyebrow(doc, label, x + 10 * s, y + th / 2 - 4 * s, 7 * s, pal.aInk, lw);
      write(doc, text, x + lw, y + 7 * s, { size: 9 * s, color: INK, width: tw - 16 * s });
      doc.save().moveTo(x + lw - 9 * s, y + 5 * s).lineTo(x + lw - 9 * s, y + th - 5 * s).lineWidth(0.8).strokeColor(pal.a).stroke().restore();
    }
    used += th + 16 * s;
  }
  const top = y + used;

  if (fw.layout === "none") {
    const msg = "The article does not name a theoretical or conceptual framework, so none is drawn here.";
    const h = textH(doc, msg, F.oblique, 10 * s, w - 40 * s) + 30 * s;
    if (draw) {
      doc.save().roundedRect(x, top, w, h, 8 * s).dash(4 * s, { space: 3 * s }).lineWidth(1).strokeColor(RULE).stroke().undash().restore();
      write(doc, msg, x + 20 * s, top + 15 * s, { font: F.oblique, size: 10 * s, color: MUTED, width: w - 40 * s, align: "center" });
    }
    return used + h;
  }

  if (fw.layout === "theory") {
    const theories = fw.theories.length ? fw.theories : [];
    const concepts = fw.constructs;
    const gap = 16 * s;
    const n = Math.max(1, theories.length);
    // Cards never get narrower than ~165pt (scaled): long theory names wrap
    // into rows instead of being broken mid-word.
    const perRow = Math.max(1, Math.min(n, Math.floor((w + gap) / (165 * s + gap))));
    const rows = Math.ceil(n / perRow);
    const tw = (w - gap * (perRow - 1)) / perRow;
    const theoryBoxes = theories.map((t) => ({ c: { id: t.name, label: t.name, role: "theory" as ConstructRole, items: t.note ? [t.note] : [] }, x: 0, y: 0, w: tw, h: 0 }));
    theoryBoxes.forEach((b) => (b.h = boxHeight(b.c, tw)));
    let rowTop = top;
    for (let r = 0; r < rows; r++) {
      const row = theoryBoxes.slice(r * perRow, (r + 1) * perRow);
      const rowH = Math.max(0, ...row.map((b) => b.h));
      const rowW = row.length * tw + (row.length - 1) * gap;
      row.forEach((b, i) => {
        b.x = x + (w - rowW) / 2 + i * (tw + gap);
        b.y = rowTop;
        b.h = rowH;
        drawBox(b);
      });
      rowTop += rowH + (r < rows - 1 ? gap : 0);
    }
    const midY = rowTop + 34 * s;
    const sw = Math.min(w, 380 * s);
    const sx = x + (w - sw) / 2;
    const studyText = studyLabel;
    const sh = textH(doc, studyText, F.serifBold, 13 * s, sw - 30 * s) + 34 * s;
    if (draw) {
      if (rows === 1) theoryBoxes.forEach((b) => arrow(doc, b.x + b.w / 2, b.y + b.h, sx + sw / 2 + (b.x + b.w / 2 - (x + w / 2)) * 0.25, midY, pal.ad, 1.4 * s, 8 * s));
      else if (theoryBoxes.length) arrow(doc, x + w / 2, rowTop, x + w / 2, midY, pal.ad, 1.4 * s, 8 * s);
      doc.save().roundedRect(sx, midY, sw, sh, 10 * s).fill(pal.pd).restore();
      eyebrow(doc, "Focus of the study", sx + 15 * s, midY + 9 * s, 6.6 * s, pal.a, sw - 30 * s);
      write(doc, studyText, sx + 15 * s, midY + 21 * s, { font: F.serifBold, size: 13 * s, color: pal.onPd, width: sw - 30 * s, align: "center" });
    }
    let end = midY + sh;
    if (concepts.length) {
      const cn = concepts.length;
      const cw = (w - gap * (cn - 1)) / cn;
      const boxes = concepts.map((c) => ({ c, x: 0, y: 0, w: cw, h: boxHeight(c, cw) }));
      const ch = Math.max(...boxes.map((b) => b.h));
      const cy = end + 34 * s;
      boxes.forEach((b, i) => {
        b.x = x + i * (cw + gap);
        b.y = cy;
        b.h = ch;
        if (draw) arrow(doc, sx + sw / 2, end, b.x + b.w / 2, cy, pal.ad, 1.4 * s, 8 * s);
        drawBox(b);
      });
      end = cy + ch;
    }
    return end - y;
  }

  if (fw.layout === "ipo") {
    const cols: ConstructRole[] = ["input", "process", "output"];
    const titles = ["INPUT", "PROCESS", "OUTPUT"];
    const gap = 40 * s;
    const cw = (w - 2 * gap) / 3;
    const groups = cols.map((r) => fw.constructs.filter((c) => c.role === r));
    // Anything not tagged I/P/O joins the column its role is closest to.
    fw.constructs.filter((c) => !cols.includes(c.role)).forEach((c) => groups[Math.min(2, ROLE_ORDER[c.role])].push(c));
    const headH = 26 * s;
    const colBody = (g: FrameworkConstruct[]) =>
      g.reduce((h, c) => {
        h += textH(doc, c.label, F.bold, 10 * s, cw - 2 * pad, 1.2 * s) + 4 * s;
        for (const it of c.items) h += textH(doc, it, F.sans, itemSize, cw - 2 * pad - 9 * s, 1) + 3 * s;
        return h + 8 * s;
      }, pad);
    if (w / s < 560) {
      // Narrow region (a poster column): stack Input, Process and Output vertically.
      const vw = w;
      const vBody = (g: FrameworkConstruct[]) =>
        g.reduce((h, c) => {
          h += textH(doc, c.label, F.bold, 10 * s, vw - 2 * pad, 1.2 * s) + 3 * s;
          if (c.items.length) h += textH(doc, c.items.join("  \u2022  "), F.sans, itemSize, vw - 2 * pad, 1.5 * s) + 3 * s;
          return h + 7 * s;
        }, pad);
      let cy = top;
      const arrowGap = 30 * s;
      groups.forEach((g, i) => {
        const col = roleColor(cols[i], pal);
        const bh = headH + Math.max(30 * s, vBody(g)) + pad * 0.4;
        if (draw) {
          doc.save().roundedRect(x, cy, vw, bh, 9 * s).fill(WHITE).restore();
          doc.save().roundedRect(x, cy, vw, bh, 9 * s).lineWidth(1.4 * s).strokeColor(col).stroke().restore();
          doc.save().roundedRect(x, cy, vw, bh, 9 * s).clip().rect(x, cy, vw, headH).fill(col).restore();
          doc.font(F.bold).fontSize(11 * s);
          const tW = doc.widthOfString(titles[i], { characterSpacing: 2 * s });
          doc.fillColor(onColor(col)).text(titles[i], x + (vw - tW) / 2, cy + headH / 2 - 11 * s * 0.38, { characterSpacing: 2 * s, lineBreak: false });
          let iy = cy + headH + pad;
          for (const c of g) {
            iy += write(doc, c.label, x + pad, iy, { font: F.bold, size: 10 * s, color: INK, width: vw - 2 * pad, lineGap: 1.2 * s }) + 3 * s;
            if (c.items.length) iy += write(doc, c.items.join("  \u2022  "), x + pad, iy, { size: itemSize, color: BODY, width: vw - 2 * pad, lineGap: 1.5 * s }) + 3 * s;
            iy += 7 * s;
          }
          if (i < 2) {
            doc.save().fillColor(pal.a)
              .moveTo(x + vw / 2 - 22 * s, cy + bh + 5 * s).lineTo(x + vw / 2 + 22 * s, cy + bh + 5 * s)
              .lineTo(x + vw / 2, cy + bh + arrowGap - 5 * s).closePath().fill().restore();
          }
        }
        cy += bh + (i < 2 ? arrowGap : 0);
      });
      return cy - y;
    }
    const bodyH = Math.max(60 * s, ...groups.map(colBody)) + pad;
    const total = headH + bodyH;
    const feedback = fw.relationships.some((r) => {
      const from = fw.constructs.find((c) => c.id === r.from);
      const to = fw.constructs.find((c) => c.id === r.to);
      return from?.role === "output" && to?.role === "input";
    });
    if (draw) {
      groups.forEach((g, i) => {
        const bx = x + i * (cw + gap);
        const col = roleColor(cols[i], pal);
        doc.save().roundedRect(bx, top, cw, total, 9 * s).fill(WHITE).restore();
        doc.save().roundedRect(bx, top, cw, total, 9 * s).lineWidth(1.4 * s).strokeColor(col).stroke().restore();
        doc.save().roundedRect(bx, top, cw, total, 9 * s).clip().rect(bx, top, cw, headH).fill(col).restore();
        doc.font(F.bold).fontSize(11 * s);
        const tW = doc.widthOfString(titles[i], { characterSpacing: 2 * s });
        doc.fillColor(onColor(col)).text(titles[i], bx + (cw - tW) / 2, top + headH / 2 - 11 * s * 0.38, { characterSpacing: 2 * s, lineBreak: false });
        let cy = top + headH + pad;
        for (const c of g) {
          cy += write(doc, c.label, bx + pad, cy, { font: F.bold, size: 10 * s, color: INK, width: cw - 2 * pad, lineGap: 1.2 * s }) + 4 * s;
          for (const it of c.items) {
            doc.save().circle(bx + pad + 2.5 * s, cy + itemSize * 0.55, 1.7 * s).fill(col).restore();
            cy += write(doc, it, bx + pad + 9 * s, cy, { size: itemSize, color: BODY, width: cw - 2 * pad - 9 * s, lineGap: 1 }) + 3 * s;
          }
          cy += 8 * s;
        }
        if (i < 2) chevron(doc, bx + cw + gap / 2, top + total / 2, gap * 0.7, 30 * s, pal.a);
      });
      if (feedback) {
        const fy = top + total + 22 * s;
        const x1 = x + 2.5 * cw + 2 * gap;
        const x2 = x + cw / 2;
        doc.save().lineWidth(1.4 * s).strokeColor(pal.ad).dash(4 * s, { space: 3 * s })
          .moveTo(x1, top + total).lineTo(x1, fy).lineTo(x2, fy).stroke().undash().restore();
        arrow(doc, x2, fy, x2, top + total + 1, pal.ad, 1.4 * s, 8 * s);
        pill("Feedback", (x1 + x2) / 2, fy);
      }
    }
    return top + total + (feedback ? 34 * s : 0) - y;
  }

  // "variables": independent → mediator → dependent, moderators above, controls below.
  const cons = fw.constructs;
  const has = (r: ConstructRole) => cons.some((c) => c.role === r);
  const colOf = (c: FrameworkConstruct): number => {
    if (c.role === "dependent" || c.role === "output") return has("mediator") || has("process") ? 2 : 1;
    if (c.role === "mediator" || c.role === "process") return 1;
    if (c.role === "concept") return has("mediator") ? 1 : 0;
    return 0;
  };
  const main = cons.filter((c) => c.role !== "moderator" && c.role !== "control");
  const moderators = cons.filter((c) => c.role === "moderator");
  const controls = cons.filter((c) => c.role === "control");
  const ncols = Math.max(2, ...main.map((c) => colOf(c) + 1));
  const colGap = Math.max(60 * s, w * 0.09);
  const cw = (w - colGap * (ncols - 1)) / ncols;
  const vGap = 14 * s;
  const boxes = new Map<string, Box>();

  let rowTop = top;
  if (moderators.length) {
    const mw = Math.min(cw, (w - vGap * (moderators.length - 1)) / moderators.length);
    const mh = Math.max(...moderators.map((c) => boxHeight(c, mw)));
    const totalW = moderators.length * mw + (moderators.length - 1) * vGap;
    moderators.forEach((c, i) => boxes.set(c.id, { c, x: x + (w - totalW) / 2 + i * (mw + vGap), y: top, w: mw, h: mh }));
    rowTop = top + mh + 36 * s;
  }
  const columns: FrameworkConstruct[][] = Array.from({ length: ncols }, () => []);
  main.forEach((c) => columns[colOf(c)].push(c));
  const colHeights = columns.map((col) => col.reduce((h, c) => h + boxHeight(c, cw), 0) + vGap * Math.max(0, col.length - 1));
  const mainH = Math.max(...colHeights, 40 * s);
  columns.forEach((col, ci) => {
    let cy = rowTop + (mainH - colHeights[ci]) / 2;
    col.forEach((c) => {
      const h = boxHeight(c, cw);
      boxes.set(c.id, { c, x: x + ci * (cw + colGap), y: cy, w: cw, h });
      cy += h + vGap;
    });
  });
  let bottom = rowTop + mainH;
  if (controls.length) {
    const ctw = Math.min(cw, (w - vGap * (controls.length - 1)) / controls.length);
    const ch = Math.max(...controls.map((c) => boxHeight(c, ctw)));
    const cy = bottom + 36 * s;
    controls.forEach((c, i) => boxes.set(c.id, { c, x: x + i * (ctw + vGap), y: cy, w: ctw, h: ch }));
    bottom = cy + ch;
  }

  if (draw) {
    // Relationships (or, when the article gives none, the role order).
    let rels = fw.relationships.slice();
    if (!rels.length) {
      for (let ci = 0; ci < ncols - 1; ci++) {
        for (const a of columns[ci]) for (const b of columns[ci + 1]) rels.push({ from: a.id, to: b.id, label: "" });
      }
      const dvs = columns[ncols - 1];
      moderators.forEach((m) => dvs.forEach((d) => rels.push({ from: m.id, to: d.id, label: "" })));
      controls.forEach((c) => dvs.forEach((d) => rels.push({ from: c.id, to: d.id, label: "" })));
    }
    rels = rels.filter((r) => boxes.has(r.from) && boxes.has(r.to));
    const outCount = new Map<string, number>();
    const inCount = new Map<string, number>();
    const outIdx = new Map<string, number>();
    const inIdx = new Map<string, number>();
    rels.forEach((r) => {
      outCount.set(r.from, (outCount.get(r.from) ?? 0) + 1);
      inCount.set(r.to, (inCount.get(r.to) ?? 0) + 1);
    });
    const port = (b: Box, side: "l" | "r", i: number, n: number) => ({ x: side === "l" ? b.x : b.x + b.w, y: b.y + b.h * (0.5 + (n > 1 ? (i / (n - 1) - 0.5) * 0.6 : 0)) });
    for (const r of rels) {
      const a = boxes.get(r.from)!;
      const b = boxes.get(r.to)!;
      const oi = outIdx.get(r.from) ?? 0;
      const ii = inIdx.get(r.to) ?? 0;
      outIdx.set(r.from, oi + 1);
      inIdx.set(r.to, ii + 1);
      let p1: { x: number; y: number };
      let p2: { x: number; y: number };
      let dashed = false;
      if (a.c.role === "moderator") {
        p1 = { x: a.x + a.w / 2, y: a.y + a.h };
        p2 = { x: b.x + b.w * 0.5, y: b.y };
        dashed = true;
      } else if (a.c.role === "control") {
        p1 = { x: a.x + a.w / 2, y: a.y };
        p2 = { x: b.x + b.w * 0.5, y: b.y + b.h };
        dashed = true;
      } else if (Math.abs(a.x - b.x) < 1) {
        const down = b.y > a.y;
        p1 = { x: a.x + a.w / 2, y: down ? a.y + a.h : a.y };
        p2 = { x: b.x + b.w / 2, y: down ? b.y : b.y + b.h };
      } else if (a.x < b.x) {
        p1 = port(a, "r", oi, outCount.get(r.from) ?? 1);
        p2 = port(b, "l", ii, inCount.get(r.to) ?? 1);
      } else {
        p1 = port(a, "l", oi, outCount.get(r.from) ?? 1);
        p2 = port(b, "r", ii, inCount.get(r.to) ?? 1);
      }
      arrow(doc, p1.x, p1.y, p2.x, p2.y, dashed ? pal.ad : pal.pd, 1.5 * s, 8 * s, dashed);
      pill(r.label, p1.x + (p2.x - p1.x) * 0.5, p1.y + (p2.y - p1.y) * 0.5);
    }
    for (const b of boxes.values()) drawBox(b);
  }
  return bottom - y;
}

/** Legend for the roles a diagram uses; returns height. */
function drawLegend(doc: Doc, fw: ResearchFramework, pal: Pal, x: number, y: number, w: number, s: number, draw = true): number {
  if (fw.layout !== "variables") return 0;
  const roles = [...new Set(fw.constructs.map((c) => c.role))];
  if (!roles.length) return 0;
  let cx = x;
  let cy = y;
  const size = 8 * s;
  for (const r of roles) {
    doc.font(F.sans).fontSize(size);
    const lw = doc.widthOfString(ROLE_LABEL[r]) + 22 * s;
    if (cx + lw > x + w) {
      cx = x;
      cy += size * 1.8;
    }
    if (draw) {
      doc.save().roundedRect(cx, cy + 1 * s, 10 * s, 7 * s, 2 * s).fill(roleColor(r, pal)).restore();
      doc.fillColor(MUTED).text(ROLE_LABEL[r], cx + 14 * s, cy, { lineBreak: false });
    }
    cx += lw;
  }
  return cy - y + size * 1.6;
}

/** Scale that makes the framework fit in maxH (between 0.55 and maxScale). */
function frameworkScale(doc: Doc, fw: ResearchFramework, pal: Pal, w: number, maxH: number, maxScale: number, studyLabel: string): number {
  for (let s = maxScale; s > 0.55; s -= 0.05) {
    if (drawFramework(doc, fw, pal, 0, 0, w, s, false, studyLabel) <= maxH) return s;
  }
  return 0.55;
}

// ─── Infographic ───────────────────────────────────────────────────────────

const IG_W = 720;

async function renderInfographic(doc: Doc, input: VisualInput, pal: Pal, qr: Buffer): Promise<number> {
  const c = input.content;
  const a = input.article;
  const M = 40;
  const CW = IG_W - 2 * M;
  let y = 0;

  // Header band
  const titleSize = fit(doc, a.title, F.serifBold, 30, 19, CW, 4 * 30 * 1.2);
  const authors = authorLine(a.authors);
  const headH =
    34 + 46 + 22 + 14 + textH(doc, a.title, F.serifBold, titleSize, CW, titleSize * 0.12) + 12 + textH(doc, authors, F.sans, 11.5, CW) + 8 + textH(doc, metaLine(input), F.sans, 9, CW) + 30;
  doc.rect(0, 0, IG_W, headH).fill(doc.linearGradient(0, 0, IG_W, headH).stop(0, pal.pd).stop(1, pal.p));
  doc.rect(0, headH, IG_W, 6).fill(pal.a);
  const onHead = onColor(pal.pd);
  const igMark = brandMark(doc, input, pal, M, 34, 46, 3.2);
  write(doc, input.brand.orgName, M + igMark + 12, 38, { font: F.bold, size: 12.5, color: onHead, width: CW - 218 - igMark, height: 16 });
  write(doc, input.brand.tagline || input.brand.journalName, M + igMark + 12, 56, { font: F.serifItalic, size: 10, color: mix(onHead, pal.pd, 0.25), width: CW - 218 - igMark, height: 14 });
  const tag = "RESEARCH INFOGRAPHIC";
  doc.font(F.bold).fontSize(8);
  const tagW = doc.widthOfString(tag, { characterSpacing: 1.6 }) + 22;
  doc.roundedRect(M + CW - tagW, 44, tagW, 22, 11).fill(pal.a);
  doc.fillColor(pal.onA).text(tag, M + CW - tagW + 11, 51, { characterSpacing: 1.6, lineBreak: false });
  y = 34 + 46 + 22;
  if (a.discipline) eyebrow(doc, a.discipline, M, y, 8.5, pal.a, CW);
  y += 14;
  y += write(doc, a.title, M, y, { font: F.serifBold, size: titleSize, color: onHead, width: CW, lineGap: titleSize * 0.12 }) + 12;
  y += write(doc, authors, M, y, { font: F.sans, size: 11.5, color: mix(pal.a, WHITE, 0.35), width: CW }) + 8;
  write(doc, metaLine(input), M, y, { size: 9, color: mix(onHead, pal.pd, 0.3), width: CW });
  y = headH + 6 + 26;

  // Keyword chips
  const chips = (a.keywords ?? "").split(/[,;]/).map((k) => k.trim()).filter(Boolean).slice(0, 6);
  if (chips.length) {
    let cx = M;
    doc.font(F.bold).fontSize(8.5);
    for (const k of chips) {
      const kw = Math.min(doc.widthOfString(T(k)) + 20, CW);
      if (cx + kw > M + CW) {
        cx = M;
        y += 24;
      }
      doc.roundedRect(cx, y, kw, 19, 9.5).fill(pal.tint);
      doc.font(F.bold).fontSize(8.5).fillColor(pal.pInk).text(T(k), cx + 10, y + 5.5, { lineBreak: false, width: kw - 16, ellipsis: true });
      cx += kw + 7;
    }
    y += 19 + 24;
  }

  const sectionTitle = (label: string, kind: IconKind) => {
    icon(doc, kind, M + 13, y + 12, 13, pal.p);
    write(doc, label, M + 34, y + 3, { font: F.serifBold, size: 18, color: INK, width: CW - 34 });
    doc.moveTo(M + 34, y + 30).lineTo(M + CW, y + 30).lineWidth(0.8).strokeColor(RULE).stroke();
    y += 42;
  };

  // A proposal / outline manuscript: say so up front, so nobody reads results into it.
  const proposal = c.stage === "proposal";
  if (proposal) {
    const note = "This article describes the study's design. Results have not yet been reported, so this summary shows the research questions, hypotheses and methods.";
    const nh = textH(doc, note, F.sans, 9.5, CW - 150, 1.5) + 22;
    doc.roundedRect(M, y, CW, nh, 9).fill(pal.tint2);
    doc.rect(M, y + 8, 3, nh - 16).fill(pal.ad);
    eyebrow(doc, "Research proposal", M + 14, y + nh / 2 - 4, 8, pal.aInk, 120);
    write(doc, note, M + 136, y + 11, { size: 9.5, color: INK, width: CW - 150, lineGap: 1.5 });
    y += nh + 22;
  }

  // Problem + aim cards
  const halves = [
    { label: "The problem", text: c.background, kind: "search" as IconKind },
    { label: "Research aim", text: c.objective, kind: "target" as IconKind },
  ].filter((h) => h.text);
  if (halves.length) {
    const gap = 16;
    const hw = halves.length === 2 ? (CW - gap) / 2 : CW;
    const ch = Math.max(...halves.map((h) => textH(doc, h.text, F.sans, 10.5, hw - 36, 2))) + 66;
    halves.forEach((h, i) => {
      const hx = M + i * (hw + gap);
      card(doc, hx, y, hw, ch, pal, { fill: i === 0 ? WHITE : pal.tint, topRule: i === 0 ? pal.p : pal.a });
      icon(doc, h.kind, hx + 30, y + 32, 14, i === 0 ? pal.p : pal.ad);
      write(doc, h.label, hx + 52, y + 24, { font: F.serifBold, size: 15, color: INK, width: hw - 70 });
      write(doc, h.text, hx + 18, y + 54, { size: 10.5, color: BODY, width: hw - 36, lineGap: 2 });
    });
    y += ch + 26;
  }

  // Research questions
  if (c.researchQuestions.length) {
    sectionTitle("Research questions", "question");
    for (const [i, q] of c.researchQuestions.entries()) {
      icon(doc, "number", M + 11, y + 8, 10, pal.tint2, pal.aInk, `Q${i + 1}`);
      y += Math.max(20, write(doc, q, M + 32, y + 1, { size: 10.5, color: BODY, width: CW - 32, lineGap: 2 })) + 8;
    }
    y += 14;
  }

  // Methods tiles
  const tiles = [
    { k: "Design", v: c.methods.design, i: "doc" as IconKind },
    { k: "Participants", v: c.methods.participants, i: "users" as IconKind },
    { k: "Setting", v: c.methods.setting, i: "pin" as IconKind },
    { k: "Instruments", v: c.methods.instruments, i: "methods" as IconKind },
    { k: "Analysis", v: c.methods.analysis, i: "chart" as IconKind },
  ].filter((t) => t.v);
  if (tiles.length) {
    sectionTitle("How the study was done", "methods");
    const perRow = tiles.length === 1 ? 1 : tiles.length === 3 || tiles.length >= 5 ? 3 : 2;
    const gap = 12;
    const tw = (CW - gap * (perRow - 1)) / perRow;
    for (let r = 0; r < tiles.length; r += perRow) {
      const row = tiles.slice(r, r + perRow);
      const th = Math.max(...row.map((t) => textH(doc, t.v, F.sans, 10, tw - 28, 1.5))) + 58;
      row.forEach((t, i) => {
        const tx = M + i * (tw + gap);
        card(doc, tx, y, tw, th, pal, { fill: pal.tint, stroke: pal.tint });
        icon(doc, t.i, tx + 26, y + 26, 13, pal.p);
        eyebrow(doc, t.k, tx + 46, y + 22, 8, pal.pInk, tw - 52);
        write(doc, t.v, tx + 14, y + 46, { size: 10, color: INK, width: tw - 28, lineGap: 1.5 });
      });
      y += th + gap;
    }
    y += 14;
  }

  // Key numbers
  if (c.keyNumbers.length) {
    sectionTitle(proposal ? "Study at a glance" : "Key numbers", "chart");
    const n = c.keyNumbers.length;
    const gap = 12;
    const tw = (CW - gap * (n - 1)) / n;
    const vs = Math.min(...c.keyNumbers.map((k) => fit(doc, k.value, F.serifBold, 34, 16, tw - 24, 40)));
    const th = Math.max(...c.keyNumbers.map((k) => textH(doc, k.label, F.sans, 9.5, tw - 24, 1))) + vs * 1.2 + 44;
    c.keyNumbers.forEach((k, i) => {
      const tx = M + i * (tw + gap);
      doc.roundedRect(tx, y, tw, th, 10).fill(doc.linearGradient(tx, y, tx + tw, y + th).stop(0, pal.p).stop(1, pal.pd));
      write(doc, k.value, tx + 12, y + 18, { font: F.serifBold, size: vs, color: pal.onP === WHITE ? WHITE : INK, width: tw - 24, align: "center" });
      doc.rect(tx + tw / 2 - 14, y + 24 + vs * 1.15, 28, 2).fill(pal.a);
      write(doc, k.label, tx + 12, y + 34 + vs * 1.15, { size: 9.5, color: pal.onP === WHITE ? mix(WHITE, pal.p, 0.15) : INK, width: tw - 24, align: "center", lineGap: 1 });
    });
    y += th + 28;
  }

  // Findings
  if (c.findings.length) {
    sectionTitle("Key findings", "check");
    c.findings.forEach((f, i) => {
      icon(doc, "number", M + 13, y + 10, 12, pal.a, pal.onA, String(i + 1));
      y += Math.max(26, write(doc, f, M + 36, y + 2, { size: 11, color: INK, width: CW - 36, lineGap: 2 })) + 10;
    });
    y += 14;
  }

  // Hypotheses (stated in the article; shown for every study that has them)
  if (c.hypotheses.length && (proposal || !c.findings.length)) {
    sectionTitle("Hypotheses", "question");
    c.hypotheses.forEach((h, i) => {
      icon(doc, "number", M + 12, y + 8, 11, pal.tint2, pal.aInk, `H${i + 1}`);
      y += Math.max(22, write(doc, h, M + 34, y + 1, { size: 10.5, color: BODY, width: CW - 34, lineGap: 2 })) + 8;
    });
    y += 14;
  }

  // Framework at a glance
  if (c.framework.layout !== "none") {
    sectionTitle(c.framework.title || "Theoretical framework", "network");
    const s = frameworkScale(doc, c.framework, pal, CW, 420, 0.95, c.shortTitle);
    y += drawFramework(doc, c.framework, pal, M, y, CW, s, true, c.shortTitle) + 10;
    y += drawLegend(doc, c.framework, pal, M, y, CW, s) + 22;
  }

  // Conclusion band (a proposal shows its stated significance instead)
  const closing = c.conclusion || (proposal ? c.significance : "");
  if (closing) {
    const ch = textH(doc, closing, F.serifItalic, 15, CW - 90, 3) + 52;
    doc.roundedRect(M, y, CW, ch, 12).fill(pal.tint2);
    doc.rect(M, y + 14, 4, ch - 28).fill(pal.ad);
    doc.font(F.serifBold).fontSize(64).fillColor(mix(pal.ad, pal.tint2, 0.45)).text("“", M + 18, y + 2, { lineBreak: false });
    eyebrow(doc, c.conclusion ? "Conclusion" : "Expected contribution", M + 60, y + 18, 8, pal.aInk);
    write(doc, closing, M + 60, y + 34, { font: F.serifItalic, size: 15, color: INK, width: CW - 90, lineGap: 3 });
    y += ch + 28;
  }

  // Implications
  if (c.implications.length) {
    sectionTitle("Implications & recommendations", "bulb");
    for (const im of c.implications) {
      icon(doc, "check", M + 10, y + 8, 9, pal.ad);
      y += Math.max(18, write(doc, im, M + 28, y + 1, { size: 10.5, color: BODY, width: CW - 28, lineGap: 2 })) + 8;
    }
    y += 14;
  }
  if (c.limitations.length) {
    eyebrow(doc, "Limitations", M, y, 8, MUTED);
    y += 14;
    y += write(doc, c.limitations.join("  ·  "), M, y, { font: F.oblique, size: 9.5, color: MUTED, width: CW, lineGap: 1.5 }) + 22;
  }

  // Footer
  const cite = citation(input);
  const footH = Math.max(120, textH(doc, cite, F.sans, 9, CW - 140, 1.5) + 70);
  doc.roundedRect(M, y, CW, footH, 12).fill(pal.tint);
  doc.image(qr, M + 16, y + 16, { width: 92 });
  eyebrow(doc, "Read the full article", M + 124, y + 18, 8, pal.pInk);
  let fy = y + 34;
  fy += write(doc, cite, M + 124, fy, { size: 9, color: INK, width: CW - 140, lineGap: 1.5 }) + 6;
  write(doc, a.articleUrl, M + 124, fy, { font: F.bold, size: 9, color: pal.pInk, width: CW - 140 });
  y += footH + 18;
  y += write(doc, FOOTNOTE, M, y, { font: F.oblique, size: 7.5, color: MUTED, width: CW }) + 16;

  // Bottom bar
  const credit = input.brand.whitelabel ? POWERED_BY_CREDIT : null;
  const barH = credit ? 52 : 40;
  doc.rect(0, y, IG_W, barH).fill(pal.pd);
  const onBar = onColor(pal.pd);
  write(doc, [input.brand.orgName, input.brand.journalName !== input.brand.orgName ? input.brand.journalName : "", issnLine(input.brand)].filter(Boolean).join("  ·  "), M, y + 12, { font: F.bold, size: 8.5, color: onBar, width: CW, height: 12 });
  if (credit) write(doc, credit, M, y + 28, { size: 7.5, color: mix(onBar, pal.pd, 0.3), width: CW, height: 11 });
  return y + barH;
}

// ─── Poster (A0 portrait) ──────────────────────────────────────────────────

const A0_W = 2383.94;
const A0_H = 3370.39;

type PosterSection = { title: string; kind: IconKind; render: (doc: Doc, x: number, y: number, w: number, b: number, draw: boolean) => number };

function posterSections(input: VisualInput, pal: Pal, figures: VisualFigure[]): PosterSection[] {
  const c = input.content;
  const out: PosterSection[] = [];
  const para = (text: string, opts: { italic?: boolean } = {}) => (doc: Doc, x: number, y: number, w: number, b: number, draw: boolean) => {
    const font = opts.italic ? F.serifItalic : F.sans;
    const size = opts.italic ? b * 1.12 : b;
    return draw ? write(doc, text, x, y, { font, size, color: BODY, width: w, lineGap: size * 0.3 }) : textH(doc, text, font, size, w, size * 0.3);
  };
  const bullets = (items: string[], kind: IconKind | "num") => (doc: Doc, x: number, y: number, w: number, b: number, draw: boolean) => {
    let cy = y;
    items.forEach((it, i) => {
      const r = b * 0.62;
      if (draw) {
        if (kind === "num") icon(doc, "number", x + r, cy + b * 0.62, r, pal.a, pal.onA, String(i + 1));
        else icon(doc, kind, x + r, cy + b * 0.62, r, pal.ad);
      }
      const h = draw ? write(doc, it, x + r * 2 + b * 0.6, cy, { size: b, color: BODY, width: w - r * 2 - b * 0.6, lineGap: b * 0.28 }) : textH(doc, it, F.sans, b, w - r * 2 - b * 0.6, b * 0.28);
      cy += Math.max(h, r * 2) + b * 0.55;
    });
    return cy - y - b * 0.55;
  };
  const figureBlock = (f: VisualFigure, maxHRatio = 0.9) => (doc: Doc, x: number, y: number, w: number, b: number, draw: boolean) => {
    const iw = w;
    let ih = (f.height / f.width) * iw;
    const maxH = w * maxHRatio;
    let fw = iw;
    if (ih > maxH) {
      ih = maxH;
      fw = (f.width / f.height) * ih;
    }
    if (draw) {
      doc.save().roundedRect(x, y, w, ih + b, 10).fill(WHITE).restore();
      doc.image(f.png, x + (w - fw) / 2, y + b / 2, { width: fw, height: ih });
    }
    const cap = f.caption || `Figure ${f.number}`;
    const ch = draw
      ? write(doc, cap, x, y + ih + b * 1.3, { font: F.oblique, size: b * 0.78, color: MUTED, width: w, lineGap: 2 })
      : textH(doc, cap, F.oblique, b * 0.78, w, 2);
    return ih + b * 1.3 + ch;
  };

  if (c.background) out.push({ title: "Introduction", kind: "search", render: para(c.background) });
  if (c.objective || c.researchQuestions.length) {
    out.push({
      title: "Objectives",
      kind: "target",
      render: (doc, x, y, w, b, draw) => {
        let h = c.objective ? para(c.objective)(doc, x, y, w, b, draw) : 0;
        if (c.researchQuestions.length) h += (h ? b * 0.8 : 0) + bullets(c.researchQuestions, "num")(doc, x, y + h + (h ? b * 0.8 : 0), w, b * 0.95, draw);
        return h;
      },
    });
  }
  const fwFig = figures.find((f) => f.isFramework);
  if (c.framework.layout !== "none" || fwFig) {
    out.push({
      title: c.framework.layout !== "none" ? c.framework.title : "Framework",
      kind: "network",
      render: (doc, x, y, w, b, draw) => {
        let h = 0;
        if (c.framework.layout !== "none") {
          const s = Math.min((b / 26) * 2.1, w / 330);
          h += drawFramework(doc, c.framework, pal, x, y, w, s, draw, c.shortTitle);
          h += b * 0.6;
          h += drawLegend(doc, c.framework, pal, x, y + h, w, s, draw);
          if (c.framework.narrative) h += b * 0.4 + para(c.framework.narrative)(doc, x, y + h + b * 0.4, w, b * 0.9, draw);
        } else if (fwFig) {
          h += figureBlock(fwFig)(doc, x, y, w, b, draw);
        }
        return h;
      },
    });
  }
  const m = c.methods;
  const mrows = [
    ["Design", m.design, "doc"],
    ["Participants", m.participants, "users"],
    ["Setting", m.setting, "pin"],
    ["Instruments", m.instruments, "methods"],
    ["Analysis", m.analysis, "chart"],
  ].filter((r) => r[1]) as [string, string, IconKind][];
  if (mrows.length) {
    out.push({
      title: "Methodology",
      kind: "methods",
      render: (doc, x, y, w, b, draw) => {
        let cy = y;
        for (const [k, v, ic] of mrows) {
          const r = b * 0.95;
          const tw = w - r * 2 - b * 0.8;
          const th = textH(doc, k, F.bold, b * 0.62, tw) + textH(doc, v, F.sans, b, tw, b * 0.25) + b * 0.25;
          const rowH = Math.max(r * 2, th) + b * 0.8;
          if (draw) {
            doc.save().roundedRect(x, cy, w, rowH, 12).fill(pal.tint).restore();
            icon(doc, ic, x + b * 0.4 + r, cy + rowH / 2, r, pal.p);
            eyebrow(doc, k, x + r * 2 + b * 0.8, cy + b * 0.4, b * 0.58, pal.pInk, tw);
            write(doc, v, x + r * 2 + b * 0.8, cy + b * 0.4 + b * 0.85, { size: b, color: INK, width: tw - b * 0.4, lineGap: b * 0.25 });
          }
          cy += rowH + b * 0.45;
        }
        return cy - y - b * 0.45;
      },
    });
  }
  const resultFig = figures.find((f) => !f.isFramework);
  const proposal = c.stage === "proposal";
  if (proposal && c.hypotheses.length) out.push({ title: "Hypotheses", kind: "question", render: bullets(c.hypotheses, "num") });
  if (c.keyNumbers.length || c.findings.length || resultFig) {
    out.push({
      title: proposal ? "Study at a glance" : "Results",
      kind: "chart",
      render: (doc, x, y, w, b, draw) => {
        let cy = y;
        if (c.keyNumbers.length) {
          const per = c.keyNumbers.length === 1 ? 1 : 2;
          const gap = b * 0.6;
          const tw = (w - gap * (per - 1)) / per;
          for (let i = 0; i < c.keyNumbers.length; i += per) {
            const row = c.keyNumbers.slice(i, i + per);
            const vs = Math.min(...row.map((k) => fit(doc, k.value, F.serifBold, b * 2.6, b * 1.2, tw - b, b * 3.2)));
            const th = Math.max(...row.map((k) => textH(doc, k.label, F.sans, b * 0.85, tw - b, 2))) + vs * 1.2 + b * 1.6;
            row.forEach((k, j) => {
              const tx = x + j * (tw + gap);
              if (draw) {
                doc.roundedRect(tx, cy, tw, th, 14).fill(doc.linearGradient(tx, cy, tx + tw, cy + th).stop(0, pal.p).stop(1, pal.pd));
                write(doc, k.value, tx + b / 2, cy + b * 0.6, { font: F.serifBold, size: vs, color: pal.onP, width: tw - b, align: "center" });
                write(doc, k.label, tx + b / 2, cy + b * 0.9 + vs * 1.15, { size: b * 0.85, color: pal.onP === WHITE ? mix(WHITE, pal.p, 0.12) : INK, width: tw - b, align: "center", lineGap: 2 });
              }
            });
            cy += th + gap;
          }
          cy += b * 0.4;
        }
        if (c.findings.length) cy += bullets(c.findings, "num")(doc, x, cy, w, b, draw) + b * 0.8;
        if (resultFig) cy += figureBlock(resultFig, 0.75)(doc, x, cy, w, b, draw);
        return cy - y;
      },
    });
  }
  const closing = c.conclusion || (proposal ? c.significance : "");
  if (closing) {
    out.push({
      title: c.conclusion ? "Conclusion" : "Expected contribution",
      kind: "bulb",
      render: (doc, x, y, w, b, draw) => {
        const size = b * 1.12;
        const h = textH(doc, closing, F.serifItalic, size, w - b * 2, size * 0.3) + b * 1.6;
        if (draw) {
          doc.save().roundedRect(x, y, w, h, 14).fill(pal.tint2).restore();
          doc.save().rect(x, y + b * 0.5, 6, h - b).fill(pal.ad).restore();
          write(doc, closing, x + b, y + b * 0.8, { font: F.serifItalic, size, color: INK, width: w - b * 2, lineGap: size * 0.3 });
        }
        return h;
      },
    });
  }
  if (c.implications.length) out.push({ title: "Recommendations", kind: "check", render: bullets(c.implications, "check") });
  if (c.limitations.length) out.push({ title: "Limitations", kind: "alert", render: bullets(c.limitations, "alert") });
  const refs = (input.article.references ?? []).filter(Boolean).slice(0, 8);
  if (refs.length) {
    out.push({
      title: "Selected references",
      kind: "book",
      render: (doc, x, y, w, b, draw) => {
        let cy = y;
        const size = b * 0.68;
        for (const r of refs) {
          cy += (draw ? write(doc, r, x, cy, { size, color: MUTED, width: w, lineGap: 1.5 }) : textH(doc, r, F.sans, size, w, 1.5)) + size * 0.6;
        }
        return cy - y;
      },
    });
  }
  return out;
}

async function renderPoster(doc: Doc, input: VisualInput, pal: Pal, qr: Buffer): Promise<void> {
  const a = input.article;
  const W = A0_W;
  const H = A0_H;
  const M = 90;
  const CW = W - 2 * M;

  // Header
  const { authors, affs } = affiliations(a.authors);
  const logo = 210;
  const textX = M + logo + 60;
  const qrS = 230;
  const textW = CW - logo - 60 - qrS - 60;
  const titleSize = fit(doc, a.title, F.serifBold, 92, 52, textW, 3 * 92 * 1.15);
  const authorStr = authors.map((x) => `${x.name}${x.marks.length && affs.length > 1 ? ` ${x.marks.join(",")}` : ""}`).join(", ");
  const affStr = affs.map((f, i) => (affs.length > 1 ? `${i + 1} ${f}` : f)).join("   ");
  let hy = 96;
  const tH = textH(doc, a.title, F.serifBold, titleSize, textW, titleSize * 0.1);
  const headH = Math.max(
    logo + 190,
    hy + 46 + tH + 30 + textH(doc, authorStr, F.bold, 36, textW) + 14 + textH(doc, affStr, F.sans, 26, textW, 4) + 20 + 36 + 70
  );
  doc.rect(0, 0, W, headH).fill(doc.linearGradient(0, 0, W, headH).stop(0, pal.pd).stop(1, pal.p));
  doc.rect(0, headH, W, 16).fill(pal.a);
  const onHead = onColor(pal.pd);
  // A wide uploaded logo fills the logo column's width at its own proportions.
  let markH = logo;
  if (input.brand.logoPng) {
    try {
      const img = (doc as any).openImage(input.brand.logoPng) as { width: number; height: number };
      const aspect = img.width / Math.max(1, img.height);
      if (aspect > 1.15) {
        markH = Math.max(logo * 0.42, (logo - logo * 0.2) / aspect + logo * 0.2);
        doc.save().roundedRect(M, hy, logo, markH, logo * 0.1).fill(WHITE).restore();
        doc.image(img as any, M + logo * 0.1, hy + logo * 0.1, { fit: [logo * 0.8, markH - logo * 0.2], align: "center", valign: "center" });
      } else brandMark(doc, input, pal, M, hy, logo);
    } catch {
      brandMark(doc, input, pal, M, hy, logo);
    }
  } else brandMark(doc, input, pal, M, hy, logo);
  write(doc, input.brand.orgName, M, hy + markH + 24, { font: F.bold, size: 24, color: onHead, width: logo + 40, align: "left" });
  const kindLabel = input.content.stage === "proposal" ? "Research proposal poster" : "Research poster";
  eyebrow(doc, a.discipline ? `${a.discipline}  ·  ${kindLabel}` : kindLabel, textX, hy, 26, pal.a, textW);
  hy += 46;
  hy += write(doc, a.title, textX, hy, { font: F.serifBold, size: titleSize, color: onHead, width: textW, lineGap: titleSize * 0.1 }) + 30;
  hy += write(doc, authorStr, textX, hy, { font: F.bold, size: 36, color: mix(pal.a, WHITE, 0.3), width: textW }) + 14;
  if (affStr) hy += write(doc, affStr, textX, hy, { size: 26, color: mix(onHead, pal.pd, 0.2), width: textW, lineGap: 4 }) + 20;
  write(doc, metaLine(input), textX, hy, { size: 26, color: mix(onHead, pal.pd, 0.3), width: textW });
  const qx = W - M - qrS;
  doc.roundedRect(qx - 14, 96 - 14, qrS + 28, qrS + 70, 18).fill(WHITE);
  doc.image(qr, qx, 96, { width: qrS });
  doc.font(F.bold).fontSize(20).fillColor(pal.pInk).text("SCAN FOR THE FULL ARTICLE", qx - 6, 96 + qrS + 16, { width: qrS + 12, align: "center", characterSpacing: 1 });

  // Footer
  const credit = input.brand.whitelabel ? POWERED_BY_CREDIT : null;
  const footH = 190;
  const footY = H - footH;
  doc.rect(0, footY, W, footH).fill(pal.pd);
  doc.rect(0, footY, W, 10).fill(pal.a);
  const onFoot = onColor(pal.pd);
  eyebrow(doc, "Cite this article", M, footY + 40, 20, pal.a);
  write(doc, citation(input), M, footY + 72, { size: 24, color: onFoot, width: CW * 0.62, lineGap: 4, height: 100 });
  const rx = M + CW * 0.66;
  const rw = CW * 0.34;
  write(doc, [input.brand.orgName, issnLine(input.brand)].filter(Boolean).join("  ·  "), rx, footY + 40, { font: F.bold, size: 24, color: onFoot, width: rw, align: "right", height: 64 });
  write(doc, [input.brand.email, input.article.articleUrl].filter(Boolean).join("  ·  "), rx, footY + 106, { size: 19, color: mix(onFoot, pal.pd, 0.25), width: rw, align: "right", height: 50 });
  if (credit) write(doc, credit, rx, footY + 150, { size: 17, color: mix(onFoot, pal.pd, 0.35), width: rw, align: "right", height: 24 });

  // Columns
  const top = headH + 16 + 70;
  const bottom = footY - 60;
  const gutter = 70;
  const ncol = 3;
  const colW = (CW - gutter * (ncol - 1)) / ncol;
  const p = probe(colW + 20);
  const sections = posterSections(input, pal, input.figures ?? []);
  // Section heading: one line when it fits at a readable size, else two lines.
  const headLayout = (b: number, title: string) => {
    const tw = colW - b * 2.6;
    const one = fit(p, title, F.serifBold, b * 1.55, b * 1.25, tw, b * 1.9);
    const fitsOne = textH(p, title, F.serifBold, one, tw) <= one * 1.35;
    const size = fitsOne ? one : b * 1.25;
    const th = fitsOne ? b * 2 : textH(p, title, F.serifBold, size, tw, size * 0.08) + b * 0.45;
    return { size, th, h: th + b * 0.9 };
  };

  // Sections keep their reading order and are split into three columns so
  // the tallest column is as short as possible (no empty third column).
  const plan = (b: number) => {
    const items = sections.map((s) => ({ s, h: headLayout(b, s.title).h + s.render(p, 0, 0, colW, b, false) + b * 1.6 }));
    const n = items.length;
    const k = Math.min(ncol, n);
    const sum = (i: number, j: number) => items.slice(i, j).reduce((t, x) => t + x.h, 0);
    let best: { cuts: number[]; max: number } = { cuts: [n], max: Infinity };
    const search = (start: number, left: number, cuts: number[], max: number) => {
      if (max >= best.max) return;
      if (left === 1) {
        const m = Math.max(max, sum(start, n));
        if (m < best.max) best = { cuts: [...cuts, n], max: m };
        return;
      }
      for (let end = start + 1; end <= n - (left - 1); end++) search(end, left - 1, [...cuts, end], Math.max(max, sum(start, end)));
    };
    search(0, k, [], 0);
    const cols: { s: PosterSection; h: number }[][] = [];
    let from = 0;
    for (const cut of best.cuts) {
      cols.push(items.slice(from, cut));
      from = cut;
    }
    return { cols, ok: best.max <= bottom - top };
  };
  let base = 50;
  let layout = plan(base);
  while (!layout.ok && base > 17) {
    base -= 1;
    layout = plan(base);
  }
  layout.cols.slice(0, ncol).forEach((col, ci) => {
    const x = M + ci * (colW + gutter);
    const used = col.reduce((t, s) => t + s.h, 0);
    const spare = bottom - top - used;
    const extra = col.length > 1 ? Math.min(base * 2.4, Math.max(0, spare) / (col.length - 1)) : 0;
    let y = top;
    for (const { s, h } of col) {
      const b = base;
      const hl = headLayout(b, s.title);
      icon(doc, s.kind, x + b * 1.05, y + b * 1.05, b * 1.05, pal.p);
      write(doc, s.title, x + b * 2.6, y + b * 0.25 + (b * 1.55 - hl.size) * 0.6, { font: F.serifBold, size: hl.size, color: INK, width: colW - b * 2.6, lineGap: hl.size * 0.08 });
      doc.moveTo(x, y + hl.th + b * 0.35).lineTo(x + colW, y + hl.th + b * 0.35).lineWidth(3).strokeColor(pal.a).stroke();
      s.render(doc, x, y + hl.h, colW, b, true);
      y += h + extra;
    }
  });
  write(doc, FOOTNOTE, M, bottom + 18, { font: F.oblique, size: 17, color: MUTED, width: CW, height: 24 });
}

// ─── Graphical abstract (2.5 : 1) ──────────────────────────────────────────

const GA_W = 1500;
const GA_H = 600;

async function renderGraphicalAbstract(doc: Doc, input: VisualInput, pal: Pal, qr: Buffer): Promise<void> {
  const c = input.content;
  const a = input.article;
  const W = GA_W;
  const H = GA_H;
  const M = 34;
  const CW = W - 2 * M;

  // Top bar
  const barH = 62;
  doc.rect(0, 0, W, barH).fill(doc.linearGradient(0, 0, W, 0).stop(0, pal.pd).stop(1, pal.p));
  doc.rect(0, barH, W, 4).fill(pal.a);
  const onBar = onColor(pal.pd);
  const gaMark = brandMark(doc, input, pal, M, 11, 40, 3.2);
  write(doc, input.brand.orgName, M + gaMark + 12, 15, { font: F.bold, size: 13, color: onBar, width: 700, height: 17 });
  write(doc, input.brand.journalName, M + gaMark + 12, 34, { font: F.serifItalic, size: 10.5, color: mix(onBar, pal.pd, 0.25), width: 700, height: 14 });
  {
    const tag = c.stage === "proposal" ? "Graphical abstract  ·  Research proposal" : "Graphical abstract";
    doc.font(F.bold).fontSize(11);
    const tw = doc.widthOfString(tag.toUpperCase(), { characterSpacing: 11 * 0.18 }) + 4;
    eyebrow(doc, tag, W - M - tw, 25, 11, pal.a, tw + 4);
  }
  doc.font(F.bold).fontSize(11);

  // Title
  const tSize = fit(doc, c.shortTitle || a.title, F.serifBold, 26, 16, CW, 64);
  const ty = barH + 22;
  const tH = write(doc, c.shortTitle || a.title, M, ty, { font: F.serifBold, size: tSize, color: INK, width: CW, align: "center", lineGap: 2 });

  // Panels
  const footH = 44;
  const top = ty + tH + 34;
  const bottom = H - footH - 20;
  const gap = 46;
  const pw = (CW - 3 * gap) / 4;
  const ph = bottom - top;
  const m = c.methods;
  const approach = [m.design, m.participants, m.setting, m.analysis].filter(Boolean);
  const proposal = c.stage === "proposal";
  const panels: { title: string; kind: IconKind; fill: string; body: (x: number, y: number, w: number, h: number) => void }[] = [
    {
      title: "Context",
      kind: "search",
      fill: pal.p,
      body: (x, y, w, h) => {
        const text = [c.background, c.objective ? `Aim: ${c.objective}` : ""].filter(Boolean).join("\n\n") || "See the article for the study context.";
        const size = fit(doc, text, F.sans, 19, 8.5, w, h);
        write(doc, text, x, y, { size, color: BODY, width: w, lineGap: size * 0.2, height: h });
      },
    },
    {
      title: "Approach",
      kind: "methods",
      fill: mix(pal.p, pal.pd, 0.5),
      body: (x, y, w, h) => {
        const items = approach.length ? approach : [m.instruments].filter(Boolean);
        if (!items.length) {
          write(doc, "Methods are described in the full article.", x, y, { font: F.oblique, size: 12, color: MUTED, width: w });
          return;
        }
        const icons: IconKind[] = ["doc", "users", "pin", "chart"];
        let size = 18;
        const need = (sz: number) => items.reduce((t, it) => t + Math.max(sz * 2, textH(doc, it, F.sans, sz, w - sz * 2.4, 1)) + sz * 0.8, 0);
        while (size > 8.5 && need(size) > h) size -= 0.5;
        let cy = y;
        items.forEach((it, i) => {
          icon(doc, icons[i] ?? "doc", x + size * 0.85, cy + size * 0.85, size * 0.85, pal.tint, pal.pInk);
          const ih = write(doc, it, x + size * 2.4, cy + 1, { size, color: INK, width: w - size * 2.4, lineGap: 1 });
          cy += Math.max(size * 1.9, ih) + size * 0.8;
        });
      },
    },
    {
      title: proposal ? (c.hypotheses.length ? "Hypotheses" : "Research questions") : "Key findings",
      kind: proposal ? "question" : "chart",
      fill: pal.pd,
      body: (x, y, w, h) => {
        let cy = y;
        const nums = c.keyNumbers.slice(0, 2);
        if (nums.length) {
          const tw = (w - 10 * (nums.length - 1)) / nums.length;
          const vs = Math.min(...nums.map((k) => fit(doc, k.value, F.serifBold, 36, 14, tw - 12, 42)));
          const th = Math.max(...nums.map((k) => textH(doc, k.label, F.sans, 10.5, tw - 12, 1))) + vs * 1.2 + 20;
          nums.forEach((k, i) => {
            const tx = x + i * (tw + 10);
            doc.roundedRect(tx, cy, tw, th, 8).fill(pal.tint2);
            write(doc, k.value, tx + 6, cy + 8, { font: F.serifBold, size: vs, color: pal.aInk, width: tw - 12, align: "center" });
            write(doc, k.label, tx + 6, cy + 10 + vs * 1.12, { size: 10.5, color: INK, width: tw - 12, align: "center", lineGap: 1 });
          });
          cy += th + 12;
        }
        const finds = (proposal ? (c.hypotheses.length ? c.hypotheses : c.researchQuestions) : c.findings).slice(0, nums.length ? 2 : 3);
        const left = y + h - cy;
        let size = 17;
        const need = (sz: number) => finds.reduce((t, f) => t + textH(doc, f, F.sans, sz, w - 18, 1) + sz * 0.7, 0);
        while (size > 8 && need(size) > left) size -= 0.5;
        for (const f of finds) {
          if (cy >= y + h - size) break;
          doc.circle(x + 4, cy + size * 0.55, 3).fill(pal.a);
          cy += write(doc, f, x + 14, cy, { size, color: INK, width: w - 18, lineGap: 1, height: y + h - cy }) + size * 0.7;
        }
      },
    },
    {
      title: proposal ? "Expected contribution" : "Conclusion",
      kind: "bulb",
      fill: pal.ad,
      body: (x, y, w, h) => {
        const imp = c.implications[0] ?? "";
        const main = proposal ? c.significance || c.objective : c.conclusion || c.findings[0] || "";
        if (!main) {
          write(doc, "See the full article.", x, y, { font: F.oblique, size: 12, color: MUTED, width: w });
          return;
        }
        const size = fit(doc, main, F.serifItalic, 23, 9.5, w, imp ? h * 0.6 : h);
        const mh = write(doc, main, x, y, { font: F.serifItalic, size, color: INK, width: w, lineGap: size * 0.2, height: imp ? h * 0.62 : h });
        if (imp) {
          const iy = y + mh + 14;
          doc.moveTo(x, iy - 7).lineTo(x + 40, iy - 7).lineWidth(2).strokeColor(pal.a).stroke();
          eyebrow(doc, "Implication", x, iy, 7.5, pal.aInk, w);
          const isz = fit(doc, imp, F.sans, 15, 8, w, y + h - iy - 14);
          write(doc, imp, x, iy + 13, { size: isz, color: BODY, width: w, lineGap: 1, height: y + h - iy - 13 });
        }
      },
    },
  ];
  panels.forEach((pn, i) => {
    const x = M + i * (pw + gap);
    doc.roundedRect(x, top, pw, ph, 14).fill(WHITE);
    doc.roundedRect(x, top, pw, ph, 14).lineWidth(1.2).strokeColor(mix(pn.fill, WHITE, 0.6)).stroke();
    doc.save().roundedRect(x, top, pw, ph, 14).clip().rect(x, top, pw, 56).fill(pn.fill).restore();
    icon(doc, pn.kind, x + 34, top + 28, 18, WHITE, inkOf(pn.fill));
    write(doc, pn.title, x + 62, top + 18, { font: F.serifBold, size: 18, color: onColor(pn.fill), width: pw - 74, height: 24 });
    pn.body(x + 18, top + 72, pw - 36, ph - 72 - 16);
    if (i < 3) chevron(doc, x + pw + gap / 2, top + ph / 2, gap * 0.72, 40, pal.a);
  });

  // Footer strip
  const fy = H - footH;
  doc.rect(0, fy, W, footH).fill(pal.tint);
  doc.image(qr, W - M - 34, fy + 5, { width: 34 });
  const credit = input.brand.whitelabel ? POWERED_BY_CREDIT : null;
  const year = pubYear(a);
  const left = [authorLine(a.authors, 3), input.brand.journalName, year ? String(year) : "", a.doi ? `doi.org/${a.doi}` : ""].filter(Boolean).join("  ·  ");
  write(doc, left, M, fy + 10, { font: F.bold, size: 9.5, color: INK, width: CW - 60, height: 13 });
  write(doc, [input.brand.orgName, credit].filter(Boolean).join("  ·  "), M, fy + 25, { size: 8, color: MUTED, width: CW - 60, height: 11 });
}

// ─── Framework (A4 landscape) ──────────────────────────────────────────────

const A4L_W = 841.89;
const A4L_H = 595.28;

async function renderFramework(doc: Doc, input: VisualInput, pal: Pal, qr: Buffer): Promise<void> {
  const c = input.content;
  const fw = c.framework;
  const a = input.article;
  const W = A4L_W;
  const H = A4L_H;
  const M = 40;
  const CW = W - 2 * M;
  const credit = input.brand.whitelabel ? POWERED_BY_CREDIT : null;
  const label = fw.layout !== "none" ? fw.title || "Theoretical Framework" : "Theoretical Framework";

  const header = (eyebrowText: string) => {
    const bh = 64;
    doc.rect(0, 0, W, bh).fill(doc.linearGradient(0, 0, W, 0).stop(0, pal.pd).stop(1, pal.p));
    doc.rect(0, bh, W, 3).fill(pal.a);
    const on = onColor(pal.pd);
    const fwMark = brandMark(doc, input, pal, M, 12, 40, 3.2);
    write(doc, input.brand.orgName, M + fwMark + 12, 15, { font: F.bold, size: 11.5, color: on, width: 420, height: 15 });
    write(doc, input.brand.journalName, M + fwMark + 12, 33, { font: F.serifItalic, size: 9.5, color: mix(on, pal.pd, 0.25), width: 420, height: 13 });
    doc.font(F.bold).fontSize(8);
    const tw = doc.widthOfString(eyebrowText.toUpperCase(), { characterSpacing: 1.4 }) + 22;
    doc.roundedRect(W - M - tw, 21, tw, 21, 10.5).fill(pal.a);
    doc.fillColor(pal.onA).text(eyebrowText.toUpperCase(), W - M - tw + 11, 27.5, { characterSpacing: 1.4, lineBreak: false });
    return bh + 3;
  };
  const footer = () => {
    const fy = H - 46;
    doc.moveTo(M, fy).lineTo(W - M, fy).lineWidth(0.6).strokeColor(RULE).stroke();
    doc.image(qr, W - M - 34, fy + 6, { width: 34 });
    write(doc, citation(input), M, fy + 7, { size: 7.4, color: INK, width: CW - 50, height: 19, lineGap: 0.5 });
    write(doc, [input.brand.orgName, issnLine(input.brand), credit].filter(Boolean).join("  ·  "), M, fy + 28, { size: 7, color: MUTED, width: CW - 50, height: 10 });
  };

  // Page 1: the diagram.
  let y = header(label) + 18;
  y += write(doc, label, M, y, { font: F.serifBold, size: 21, color: INK, width: CW, height: 26 }) + 2;
  y += write(doc, a.title, M, y, { font: F.serifItalic, size: 11, color: MUTED, width: CW, height: 28 }) + 14;
  const narrative = fw.layout !== "none" ? fw.narrative : "";
  const narrH = narrative ? textH(doc, narrative, F.sans, 9.5, CW - 30, 1.5) + 22 : 0;
  const legendReserve = fw.layout === "variables" ? 26 : 0;
  const avail = H - 46 - 14 - y - narrH - legendReserve - 8;
  const s = frameworkScale(doc, fw, pal, CW, avail, 1.7, c.shortTitle);
  const dh = drawFramework(doc, fw, pal, 0, 0, CW, s, false, c.shortTitle);
  const dy = y + Math.max(0, (avail - dh) / 2);
  drawFramework(doc, fw, pal, M, dy, CW, s, true, c.shortTitle);
  y = dy + dh + 8;
  y += drawLegend(doc, fw, pal, M, y, CW, Math.min(1.2, s)) + 4;
  if (narrative) {
    doc.roundedRect(M, y, CW, narrH - 6, 8).fill(pal.tint);
    write(doc, narrative, M + 15, y + 8, { size: 9.5, color: BODY, width: CW - 30, lineGap: 1.5 });
  }
  footer();

  // Then each framework figure exactly as published.
  const figs = (input.figures ?? []).filter((f) => f.isFramework);
  for (const f of figs) {
    doc.addPage({ size: [W, H], margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    let py = header("As published in the article") + 18;
    py += write(doc, `Figure ${f.number}`, M, py, { font: F.serifBold, size: 18, color: INK, width: CW, height: 22 }) + 8;
    const capH = f.caption ? textH(doc, f.caption, F.oblique, 9.5, CW, 1.5) + 12 : 0;
    const maxH = H - 46 - 18 - py - capH;
    doc.roundedRect(M, py, CW, maxH, 8).fill(WHITE);
    doc.roundedRect(M, py, CW, maxH, 8).lineWidth(0.6).strokeColor(RULE).stroke();
    doc.image(f.png, M + 12, py + 12, { fit: [CW - 24, maxH - 24], align: "center", valign: "center" });
    if (f.caption) write(doc, f.caption, M, py + maxH + 10, { font: F.oblique, size: 9.5, color: MUTED, width: CW, lineGap: 1.5, height: capH });
    footer();
  }
}

// ─── Entry point ───────────────────────────────────────────────────────────

export async function buildResearchVisualPdf(kind: ResearchVisualKind, input: VisualInput): Promise<Buffer> {
  const pal = palette(input.brand);
  const qr = await qrPng(input.article.articleUrl);
  const info = docInfo(input, kind);
  if (kind === "infographic") {
    // Lay out once on a tall scratch page to learn the height, then for real.
    const height = await renderInfographic(probe(IG_W), input, pal, qr);
    const doc = newDoc(IG_W, Math.ceil(height), info);
    await renderInfographic(doc, input, pal, qr);
    return finish(doc);
  }
  if (kind === "poster") {
    const doc = newDoc(A0_W, A0_H, info);
    await renderPoster(doc, input, pal, qr);
    return finish(doc);
  }
  if (kind === "graphical-abstract") {
    const doc = newDoc(GA_W, GA_H, info);
    await renderGraphicalAbstract(doc, input, pal, qr);
    return finish(doc);
  }
  const doc = newDoc(A4L_W, A4L_H, info);
  await renderFramework(doc, input, pal, qr);
  return finish(doc);
}

export function researchVisualFileName(article: { title: string }, kind: ResearchVisualKind): string {
  const slug = article.title
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 8)
    .join("-")
    .toLowerCase()
    .slice(0, 70);
  return `${slug || "article"}-${kind}.pdf`;
}
