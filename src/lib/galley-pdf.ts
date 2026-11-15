/**
 * Structured body typesetting for the PDF galley (the PDFKit path that runs
 * in production, where no Pandoc/WeasyPrint exists). The manuscript's
 * sanitized HTML is turned into blocks — headings, paragraphs, lists,
 * tables, figures, block quotes, code, references — and each block is set
 * the way a print journal sets it, instead of flattening everything into
 * same-looking paragraphs.
 *
 * Fonts: Liberation Serif (body) and Liberation Sans Bold (headings), SIL
 * OFL, bundled in src/assets/fonts/galley. They cover Greek, maths symbols
 * (≤ ≥ ≈ ± √ ∑), sub/superscript digits and typographic quotes, which the
 * built-in PDF fonts can't draw. If they can't be read the renderer falls
 * back to the built-in Times/Helvetica and transliterates what those fonts
 * lack, so a galley is always produced.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

type Doc = PDFKit.PDFDocument;

// ---------------------------------------------------------------- fonts --

export interface GalleyFonts {
  serif: string;
  serifBold: string;
  serifItalic: string;
  serifBoldItalic: string;
  sans: string;
  sansBold: string;
  /** True when the bundled Unicode fonts are in use. */
  unicode: boolean;
}

const FONT_FILES = {
  serif: "LiberationSerif-Regular.ttf",
  serifBold: "LiberationSerif-Bold.ttf",
  serifItalic: "LiberationSerif-Italic.ttf",
  serifBoldItalic: "LiberationSerif-BoldItalic.ttf",
  sansBold: "LiberationSans-Bold.ttf",
} as const;

let fontBuffers: Record<keyof typeof FONT_FILES, Buffer> | null | undefined;

function loadFontBuffers(): Record<keyof typeof FONT_FILES, Buffer> | null {
  if (fontBuffers !== undefined) return fontBuffers;
  try {
    const dir = path.join(process.cwd(), "src/assets/fonts/galley");
    const out = {} as Record<keyof typeof FONT_FILES, Buffer>;
    for (const [k, f] of Object.entries(FONT_FILES)) out[k as keyof typeof FONT_FILES] = readFileSync(path.join(dir, f));
    fontBuffers = out;
  } catch (e) {
    console.warn("[galley-pdf] bundled fonts unavailable, using built-in PDF fonts:", (e as Error).message);
    fontBuffers = null;
  }
  return fontBuffers;
}

export const BUILTIN_FONTS: GalleyFonts = {
  serif: "Times-Roman",
  serifBold: "Times-Bold",
  serifItalic: "Times-Italic",
  serifBoldItalic: "Times-BoldItalic",
  sans: "Helvetica",
  sansBold: "Helvetica-Bold",
  unicode: false,
};

/** Registers the galley fonts on `doc`; built-in fonts when the files can't be read. */
export function registerGalleyFonts(doc: Doc): GalleyFonts {
  const b = loadFontBuffers();
  if (!b) return BUILTIN_FONTS;
  try {
    doc.registerFont("G-Serif", b.serif);
    doc.registerFont("G-SerifBold", b.serifBold);
    doc.registerFont("G-SerifItalic", b.serifItalic);
    doc.registerFont("G-SerifBoldItalic", b.serifBoldItalic);
    doc.registerFont("G-SansBold", b.sansBold);
    return {
      serif: "G-Serif",
      serifBold: "G-SerifBold",
      serifItalic: "G-SerifItalic",
      serifBoldItalic: "G-SerifBoldItalic",
      // Liberation Sans Regular isn't bundled; small sans labels use Helvetica.
      sans: "Helvetica",
      sansBold: "G-SansBold",
      unicode: true,
    };
  } catch {
    return BUILTIN_FONTS;
  }
}

// Characters the bundled fonts lack, and what to print instead.
const UNICODE_GAPS: Record<string, string> = { "⁰": "0", "⁻": "-" };

// For the built-in (WinAnsi) fonts: readable stand-ins for what they can't draw.
const WINANSI_FALLBACK: Record<string, string> = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
  "⁰": "0", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁺": "+", "⁻": "-",
  "≤": "<=", "≥": ">=", "≈": "~", "≠": "!=", "√": "sqrt", "∞": "inf", "∑": "Sum", "∫": "int", "∂": "d",
  "→": "->", "←": "<-", "↔": "<->", "−": "-", "‐": "-", "‑": "-", "′": "'", "″": '"', "∼": "~",
  "α": "alpha", "β": "beta", "γ": "gamma", "δ": "delta", "ε": "epsilon", "ζ": "zeta", "η": "eta", "θ": "theta",
  "ι": "iota", "κ": "kappa", "λ": "lambda", "ν": "nu", "ξ": "xi", "π": "pi", "ρ": "rho", "σ": "sigma",
  "τ": "tau", "υ": "upsilon", "φ": "phi", "χ": "chi", "ψ": "psi", "ω": "omega",
  "Γ": "Gamma", "Δ": "Delta", "Θ": "Theta", "Λ": "Lambda", "Π": "Pi", "Σ": "Sigma", "Φ": "Phi", "Ψ": "Psi", "Ω": "Omega",
};
// Beyond Latin-1, the WinAnsi code page has only these.
const WINANSI_EXTRA = new Set([..."€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"]);

/** Makes `text` printable in the active font family (never drops a character silently). */
export function printable(text: string, fonts: GalleyFonts): string {
  if (fonts.unicode) return text.replace(/[⁰⁻]/g, (c) => UNICODE_GAPS[c] ?? c);
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x100 || WINANSI_EXTRA.has(ch)) out += ch;
    else if (WINANSI_FALLBACK[ch] !== undefined) out += WINANSI_FALLBACK[ch];
    else if (ch === "µ" || ch === "μ") out += "µ";
    else out += ch.normalize("NFKD").replace(/[^\x20-\xFF]/g, "") || "?";
  }
  return out;
}

// ------------------------------------------------------------ HTML tree --

interface El {
  tag: string;
  attrs: Record<string, string>;
  children: Node[];
}
type Node = El | string;

const VOID_TAGS = new Set(["br", "hr", "img", "meta", "link", "input", "col", "wbr"]);
const DROP_TAGS = new Set(["head", "style", "script", "title", "header", "nav", "footer", "noscript"]);

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : m;
    }
    const named: Record<string, string> = {
      amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
      lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", times: "×", plusmn: "±", deg: "°", micro: "µ", middot: "·",
      le: "≤", ge: "≥", ne: "≠", asymp: "≈", minus: "−", copy: "©", reg: "®", trade: "™", sect: "§", para: "¶",
      alpha: "α", beta: "β", gamma: "γ", delta: "δ", mu: "μ", sigma: "σ", chi: "χ", sup2: "²", sup3: "³", sup1: "¹",
    };
    return named[e.toLowerCase()] ?? m;
  });
}

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  return attrs;
}

/** Small, forgiving HTML parser — input is already sanitized (src/lib/galley.ts). */
export function parseHtml(html: string): El {
  const root: El = { tag: "#root", attrs: {}, children: [] };
  const stack: El[] = [root];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<!DOCTYPE[^>]*>|<\?[^>]*>|<\/([a-zA-Z][a-zA-Z0-9]*)\s*>|<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^>]*?)?)(\/?)>|([^<]+|<)/g;
  let dropDepth = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, close, open, rawAttrs, selfClose, text] = m;
    const top = stack[stack.length - 1];
    if (text !== undefined) {
      if (!dropDepth) top.children.push(decodeEntities(text));
    } else if (open) {
      const tag = open.toLowerCase();
      if (DROP_TAGS.has(tag)) {
        if (!selfClose) dropDepth++;
        continue;
      }
      if (dropDepth) continue;
      const el: El = { tag, attrs: parseAttrs(rawAttrs || ""), children: [] };
      top.children.push(el);
      if (!selfClose && !VOID_TAGS.has(tag)) stack.push(el);
    } else if (close) {
      const tag = close.toLowerCase();
      if (DROP_TAGS.has(tag)) {
        dropDepth = Math.max(0, dropDepth - 1);
        continue;
      }
      if (dropDepth) continue;
      // Close the nearest matching element; stray closers are ignored.
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
    }
  }
  return root;
}

// --------------------------------------------------------------- blocks --

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  sup?: boolean;
  sub?: boolean;
  code?: boolean;
  link?: string;
}

export type Block =
  | { kind: "heading"; level: number; runs: Run[] }
  | { kind: "para"; runs: Run[] }
  | { kind: "list"; ordered: boolean; items: { depth: number; runs: Run[]; marker: string }[] }
  | { kind: "table"; rows: { header: boolean; cells: Run[][] }[]; caption?: Run[] }
  | { kind: "quote"; runs: Run[] }
  | { kind: "code"; text: string }
  | { kind: "image"; src: string; alt: string; caption?: Run[] }
  | { kind: "rule" };

const BLOCK_TAGS = new Set([
  "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "table", "blockquote", "pre", "figure", "hr", "img",
  "div", "section", "article", "main", "body", "html", "aside", "dl", "thead", "tbody",
]);

function inlineRuns(nodes: Node[], style: Omit<Run, "text"> = {}, out: Run[] = []): Run[] {
  for (const n of nodes) {
    if (typeof n === "string") {
      out.push({ ...style, text: n });
      continue;
    }
    const s = { ...style };
    switch (n.tag) {
      case "strong": case "b": case "th": s.bold = true; break;
      case "em": case "i": case "cite": case "var": s.italic = true; break;
      case "sup": s.sup = true; break;
      case "sub": s.sub = true; break;
      case "code": case "kbd": case "samp": s.code = true; break;
      case "a": if (n.attrs.href && /^(https?:|mailto:)/i.test(n.attrs.href)) s.link = n.attrs.href; break;
      case "br": out.push({ ...style, text: "\n" }); continue;
      case "img": continue;
    }
    inlineRuns(n.children, s, out);
  }
  return out;
}

/** Collapses whitespace across runs the way a browser would. */
export function normalizeRuns(runs: Run[]): Run[] {
  const out: Run[] = [];
  let lastSpace = true;
  for (const r of runs) {
    let t = "";
    for (const part of r.text.split(/(\n)/)) {
      if (part === "\n") {
        t = t.replace(/ $/, "") + "\n";
        lastSpace = true;
        continue;
      }
      let p = part.replace(/[ \t\r\f\v]+/g, " ").replace(/ /g, " ");
      if (lastSpace) p = p.replace(/^ /, "");
      if (p) lastSpace = p.endsWith(" ");
      t += p;
    }
    if (t) {
      const prev = out[out.length - 1];
      const same =
        prev && prev.bold === r.bold && prev.italic === r.italic && prev.sup === r.sup && prev.sub === r.sub && prev.code === r.code && prev.link === r.link;
      if (same) prev.text += t;
      else out.push({ ...r, text: t });
    }
  }
  if (out.length) out[out.length - 1].text = out[out.length - 1].text.replace(/[ \n]+$/, "");
  return out.filter((r) => r.text);
}

const runsText = (runs: Run[]) => runs.map((r) => r.text).join("");

function hasBlockChild(el: El): boolean {
  return el.children.some((c) => typeof c !== "string" && BLOCK_TAGS.has(c.tag));
}

function collectList(el: El, depth: number, items: { depth: number; runs: Run[]; marker: string }[]) {
  const ordered = el.tag === "ol";
  let n = Number(el.attrs.start) || 1;
  for (const li of el.children) {
    if (typeof li === "string" || li.tag !== "li") continue;
    const inline = li.children.filter((c) => typeof c === "string" || (c.tag !== "ul" && c.tag !== "ol"));
    const runs = normalizeRuns(inlineRuns(inline));
    items.push({ depth, runs, marker: ordered ? `${n}.` : depth % 2 ? "◦" : "•" });
    n++;
    for (const c of li.children) if (typeof c !== "string" && (c.tag === "ul" || c.tag === "ol")) collectList(c, depth + 1, items);
  }
}

function collectTable(el: El): Block {
  const rows: { header: boolean; cells: Run[][] }[] = [];
  let caption: Run[] | undefined;
  const walk = (n: El, inHead: boolean) => {
    for (const c of n.children) {
      if (typeof c === "string") continue;
      if (c.tag === "caption") caption = normalizeRuns(inlineRuns(c.children));
      else if (c.tag === "thead") walk(c, true);
      else if (c.tag === "tbody" || c.tag === "tfoot") walk(c, false);
      else if (c.tag === "tr") {
        const cells = c.children.filter((x): x is El => typeof x !== "string" && (x.tag === "td" || x.tag === "th"));
        if (!cells.length) continue;
        rows.push({ header: inHead || cells.every((x) => x.tag === "th"), cells: cells.map((x) => normalizeRuns(inlineRuns(x.children))) });
      }
    }
  };
  walk(el, false);
  return { kind: "table", rows, caption };
}

/** Turns the sanitized manuscript HTML into typeset-ready blocks. */
export function htmlToBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  let loose: Node[] = [];
  const flushLoose = () => {
    const runs = normalizeRuns(inlineRuns(loose));
    if (runsText(runs).trim()) blocks.push({ kind: "para", runs });
    loose = [];
  };
  const visit = (nodes: Node[]) => {
    for (const n of nodes) {
      if (typeof n === "string" || !BLOCK_TAGS.has(n.tag)) {
        loose.push(n);
        continue;
      }
      flushLoose();
      const tag = n.tag;
      if (/^h[1-6]$/.test(tag)) {
        const runs = normalizeRuns(inlineRuns(n.children));
        if (runsText(runs).trim()) blocks.push({ kind: "heading", level: Number(tag[1]), runs });
      } else if (tag === "p") {
        if (hasBlockChild(n)) visit(n.children);
        else {
          const runs = normalizeRuns(inlineRuns(n.children));
          if (runsText(runs).trim()) blocks.push({ kind: "para", runs });
          // A paragraph holding only an image (mammoth's output for figures).
          for (const c of n.children) if (typeof c !== "string" && c.tag === "img") pushImage(c);
        }
      } else if (tag === "ul" || tag === "ol") {
        const items: { depth: number; runs: Run[]; marker: string }[] = [];
        collectList(n, 0, items);
        if (items.length) blocks.push({ kind: "list", ordered: tag === "ol", items });
      } else if (tag === "table") {
        const t = collectTable(n);
        if (t.kind === "table" && t.rows.length) blocks.push(t);
      } else if (tag === "blockquote") {
        if (hasBlockChild(n)) {
          const runs = normalizeRuns(inlineRuns(n.children.flatMap((c) => (typeof c === "string" ? [c] : [c, "\n"]))));
          if (runsText(runs).trim()) blocks.push({ kind: "quote", runs });
        } else {
          const runs = normalizeRuns(inlineRuns(n.children));
          if (runsText(runs).trim()) blocks.push({ kind: "quote", runs });
        }
      } else if (tag === "pre") {
        const text = runsText(inlineRuns(n.children)).replace(/\s+$/, "");
        if (text.trim()) blocks.push({ kind: "code", text });
      } else if (tag === "hr") {
        blocks.push({ kind: "rule" });
      } else if (tag === "img") {
        pushImage(n);
      } else if (tag === "figure") {
        const img = findFirst(n, "img");
        const cap = findFirst(n, "figcaption");
        if (img) pushImage(img, cap ? normalizeRuns(inlineRuns(cap.children)) : undefined);
        else visit(n.children);
      } else {
        visit(n.children);
      }
    }
  };
  const pushImage = (img: El, caption?: Run[]) => {
    const src = img.attrs.src || "";
    if (/^data:image\/(png|jpe?g);base64,/i.test(src)) blocks.push({ kind: "image", src, alt: img.attrs.alt || "", caption });
    else if (caption && runsText(caption).trim()) blocks.push({ kind: "para", runs: caption });
  };
  visit(parseHtml(html).children);
  flushLoose();
  // Word puts a figure's caption in the paragraph under the image (and often
  // repeats it as the alt text): use that paragraph as the caption, once.
  for (let i = 0; i < blocks.length - 1; i++) {
    const img = blocks[i];
    const next = blocks[i + 1];
    if (img.kind !== "image" || img.caption?.length || next.kind !== "para") continue;
    const text = runsText(next.runs).trim();
    const norm = (v: string) => v.replace(/\s+/g, " ").trim().toLowerCase();
    if ((img.alt && norm(text) === norm(img.alt)) || /^(fig(ure)?\.?|plate|chart|graph)\s*[0-9ivx]+/i.test(text)) {
      img.caption = next.runs;
      blocks.splice(i + 1, 1);
    }
  }
  return blocks;
}

function findFirst(el: El, tag: string): El | null {
  for (const c of el.children) {
    if (typeof c === "string") continue;
    if (c.tag === tag) return c;
    const f = findFirst(c, tag);
    if (f) return f;
  }
  return null;
}

// ------------------------------------------------------------ rendering --

export interface BodyTheme {
  fonts: GalleyFonts;
  primary: string;
  accent: string;
  ink: string;
  muted: string;
  /** Plain text of leading blocks to skip (title/abstract already set above the body). */
  skipLeading?: string[];
}

const REFERENCE_HEADING = /^(\d+(\.\d+)*\.?\s+)?(references?|bibliography|works cited|literature cited|reference list|sources)\s*:?$/i;
const SECTION_NUMBER = /^((\d+(\.\d+)*\.?)|([IVXLC]+\.))\s+/;
/** "Data Collection Procedure" / "DATA COLLECTION" — most longer words capitalised. */
function isTitleLike(s: string): boolean {
  const words = s.split(/\s+/).filter((w) => w.length > 3);
  if (!words.length) return /^[A-Z]/.test(s);
  return words.filter((w) => /^[A-Z]/.test(w)).length / words.length >= 0.6;
}

/** Section titles common in research papers and theses, numbered or not. */
const SECTION_NAME = new RegExp(
  "^((\\d+(\\.\\d+)*\\.?|[IVXLC]+\\.|chapter\\s+[0-9ivxlc]+[.:]?)\\s+)?(" +
    [
      "introduction", "background( of the study)?", "literature review", "review of (related )?literature", "related (work|literature|studies)",
      "theoretical (and conceptual )?framework", "conceptual framework", "statement of the problem", "research questions?", "hypothes[ie]s",
      "significance of the study", "scope and (delimitation|limitations?)( of the study)?", "definition of terms", "methods?", "methodology",
      "research (design|methodology|methods)", "materials and methods", "participants", "data analysis", "results?", "findings",
      "results and discussion", "discussion", "conclusions?", "conclusions? and recommendations", "summary", "recommendations?",
      "limitations", "implications", "acknowledge?ments?", "appendix( [a-z0-9]+)?", "appendices", "declarations?", "funding",
      "conflicts? of interest", "data availability( statement)?", "author contributions",
    ].join("|") +
    ")\\s*:?$",
  "i"
);

const BODY_SIZE = 10.5;
const LINE_GAP = 2.2;

function contentWidth(doc: Doc): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}
function bottomLimit(doc: Doc): number {
  return doc.page.height - doc.page.margins.bottom;
}
function ensureSpace(doc: Doc, needed: number) {
  if (doc.y + needed > bottomLimit(doc)) doc.addPage();
}

function fontFor(r: Run, t: BodyTheme, base: "serif" | "sansBold" = "serif"): string {
  const f = t.fonts;
  if (base === "sansBold") return f.sansBold;
  if (r.code) return "Courier";
  if (r.bold && r.italic) return f.serifBoldItalic;
  if (r.bold) return f.serifBold;
  if (r.italic) return f.serifItalic;
  return f.serif;
}

const SUP_MAP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
const SUB_MAP: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉" };

/**
 * Writes runs as one flowing, wrapped block. Superscripts/subscripts of
 * digits become the font's own super/subscript glyphs (clean baseline);
 * anything else is set smaller and shifted.
 */
function writeRuns(
  doc: Doc,
  runs: Run[],
  t: BodyTheme,
  opts: { x?: number; width?: number; size?: number; color?: string; align?: "left" | "justify" | "center"; indent?: number; base?: "serif" | "sansBold"; lineGap?: number }
) {
  const size = opts.size ?? BODY_SIZE;
  const prepared: Run[] = runs.map((r) => {
    if ((r.sup || r.sub) && t.fonts.unicode && /^[0-9]+$/.test(r.text)) {
      const map = r.sup ? SUP_MAP : SUB_MAP;
      return { ...r, sup: false, sub: false, text: [...r.text].map((c) => map[c] ?? c).join("") };
    }
    return r;
  });
  if (!prepared.length) return;
  const x = opts.x ?? doc.page.margins.left;
  const width = opts.width ?? contentWidth(doc);
  const common = { width, align: opts.align ?? "justify", lineGap: opts.lineGap ?? LINE_GAP, indent: opts.indent ?? 0 };
  doc.x = x;
  prepared.forEach((r, i) => {
    const last = i === prepared.length - 1;
    const rs = r.sup || r.sub ? size * 0.7 : r.code ? size * 0.9 : size;
    doc
      .font(fontFor(r, t, opts.base))
      .fontSize(rs)
      .fillColor(r.link ? t.primary : opts.color ?? t.ink);
    const textOpts: PDFKit.Mixins.TextOptions & { baseline?: number | string } = {
      ...common,
      continued: !last,
      link: r.link ?? undefined,
      underline: false,
    };
    if (r.sup) textOpts.baseline = -size * 0.33;
    if (r.sub) textOpts.baseline = size * 0.12;
    // x/y only on the first fragment; later fragments continue the line.
    if (i === 0) doc.text(printable(r.text, t.fonts), x, doc.y, textOpts);
    else doc.text(printable(r.text, t.fonts), textOpts);
  });
  // Reset so later text isn't "continued" or shifted.
  doc.font(t.fonts.serif).fontSize(size).fillColor(t.ink);
  doc.x = doc.page.margins.left;
}

function measureRuns(doc: Doc, runs: Run[], t: BodyTheme, width: number, size: number, base: "serif" | "sansBold" = "serif"): number {
  const text = printable(runsText(runs), t.fonts);
  if (!text) return 0;
  const anyBold = runs.some((r) => r.bold);
  doc.font(base === "sansBold" ? t.fonts.sansBold : anyBold ? t.fonts.serifBold : t.fonts.serif).fontSize(size);
  return doc.heightOfString(text, { width, lineGap: LINE_GAP });
}

function renderHeading(doc: Doc, b: Extract<Block, { kind: "heading" }>, t: BodyTheme, first: boolean) {
  const level = Math.min(b.level, 4);
  const size = level <= 1 ? 13 : level === 2 ? 12 : level === 3 ? 11 : 10.5;
  const before = first ? 0 : level <= 2 ? 14 : 10;
  // Keep a heading with at least three lines of what follows.
  ensureSpace(doc, before + size * 1.6 + BODY_SIZE * 4.2);
  doc.y += before;
  const text = printable(runsText(b.runs).replace(/\s+/g, " ").trim(), t.fonts);
  if (level <= 2) {
    doc.font(t.fonts.sansBold).fontSize(size).fillColor(t.primary).text(text, doc.page.margins.left, doc.y, { width: contentWidth(doc), lineGap: 1 });
  } else if (level === 3) {
    doc.font(t.fonts.serifBold).fontSize(size).fillColor(t.ink).text(text, doc.page.margins.left, doc.y, { width: contentWidth(doc), lineGap: 1 });
  } else {
    doc.font(t.fonts.serifBoldItalic).fontSize(size).fillColor(t.ink).text(text, doc.page.margins.left, doc.y, { width: contentWidth(doc), lineGap: 1 });
  }
  doc.y += level <= 2 ? 5 : 3;
}

function renderList(doc: Doc, b: Extract<Block, { kind: "list" }>, t: BodyTheme) {
  doc.y += 2;
  for (const item of b.items) {
    const indent = 14 + item.depth * 16;
    const markerW = b.ordered ? 18 : 12;
    const x = doc.page.margins.left + indent;
    const width = contentWidth(doc) - indent - markerW;
    ensureSpace(doc, Math.min(measureRuns(doc, item.runs, t, width, BODY_SIZE), BODY_SIZE * 3));
    const y = doc.y;
    doc.font(t.fonts.serif).fontSize(BODY_SIZE).fillColor(b.ordered ? t.ink : t.primary)
      .text(printable(item.marker, t.fonts), x, y, { width: markerW - 4, align: b.ordered ? "right" : "left", lineBreak: false });
    doc.y = y;
    writeRuns(doc, item.runs, t, { x: x + markerW, width, align: "left" });
    doc.y += 2.5;
  }
  doc.y += 4;
}

function renderTable(doc: Doc, b: Extract<Block, { kind: "table" }>, t: BodyTheme) {
  const size = 8.5;
  const pad = 4;
  const ncol = Math.max(...b.rows.map((r) => r.cells.length));
  const total = contentWidth(doc);
  const left = doc.page.margins.left;
  // Column widths follow the content: the longest word sets a floor, the
  // average text length shares out the rest.
  doc.font(t.fonts.serif).fontSize(size);
  const longestWord: number[] = Array(ncol).fill(20);
  const avgLen: number[] = Array(ncol).fill(1);
  for (let c = 0; c < ncol; c++) {
    let sum = 0;
    let n = 0;
    const bodyRows = b.rows.some((r) => !r.header) ? b.rows.filter((r) => !r.header) : b.rows;
    for (const r of b.rows) {
      const txt = printable(runsText(r.cells[c] ?? []), t.fonts);
      if (!txt) continue;
      if (bodyRows.includes(r)) {
        sum += Math.min(txt.length, 80);
        n++;
      }
      for (const w of txt.split(/\s+/)) longestWord[c] = Math.max(longestWord[c], Math.min(doc.widthOfString(w) + pad * 2 + 2, total / 3));
    }
    avgLen[c] = Math.max(3, n ? sum / n : 3);
  }
  const floor = longestWord.reduce((a, b2) => a + b2, 0);
  const widths =
    floor >= total
      ? longestWord.map((w) => (w / floor) * total)
      : longestWord.map((w, i) => w + ((total - floor) * avgLen[i]) / avgLen.reduce((a, b2) => a + b2, 0));

  const header = b.rows.filter((r) => r.header);
  const rowHeight = (r: { header: boolean; cells: Run[][] }) =>
    Math.max(
      ...Array.from({ length: ncol }, (_, c) => {
        const runs = r.cells[c] ?? [];
        doc.font(r.header ? t.fonts.serifBold : t.fonts.serif).fontSize(size);
        const txt = printable(runsText(runs), t.fonts);
        return txt ? doc.heightOfString(txt, { width: widths[c] - pad * 2, lineGap: 1 }) : size;
      })
    ) + pad * 2;

  const drawRow = (r: { header: boolean; cells: Run[][] }, shaded: boolean) => {
    const h = rowHeight(r);
    if (doc.y + h > bottomLimit(doc)) {
      doc.addPage();
      // Repeat the header row on the new page.
      if (!r.header) for (const hr of header) drawRow(hr, false);
    }
    const y = doc.y;
    if (r.header) doc.save().fillColor(t.primary).fillOpacity(0.08).rect(left, y, total, h).fill().restore();
    else if (shaded) doc.save().rect(left, y, total, h).fill("#f7f6f9").restore();
    let x = left;
    for (let c = 0; c < ncol; c++) {
      const runs = r.cells[c] ?? [];
      doc.y = y + pad;
      if (runs.length) {
        writeRuns(doc, r.header ? runs.map((x2) => ({ ...x2, bold: true })) : runs, t, {
          x: x + pad,
          width: widths[c] - pad * 2,
          size,
          align: "left",
          lineGap: 1,
          color: r.header ? t.primary : t.ink,
        });
      }
      x += widths[c];
    }
    doc.y = y + h;
    doc.save().moveTo(left, doc.y).lineTo(left + total, doc.y).lineWidth(r.header ? 0.8 : 0.3).strokeColor(r.header ? t.primary : "#cfcbd8").stroke().restore();
  };

  // A short table moves whole to the next page rather than leaving one row behind.
  const fullHeight = b.rows.reduce((sum, r) => sum + rowHeight(r), 0) + 30;
  const pageRoom = bottomLimit(doc) - doc.page.margins.top;
  ensureSpace(doc, fullHeight <= pageRoom * 0.45 ? fullHeight : Math.min(rowHeight(b.rows[0]) * 3 + 20, 160));
  doc.y += 6;
  if (b.caption?.length) {
    writeRuns(doc, b.caption.map((r) => ({ ...r, bold: true })), t, { size: 9, align: "left", color: t.ink });
    doc.y += 3;
  }
  doc.save().moveTo(left, doc.y).lineTo(left + total, doc.y).lineWidth(0.8).strokeColor(t.primary).stroke().restore();
  let body = 0;
  for (const r of b.rows) drawRow(r, !r.header && body++ % 2 === 1);
  doc.x = left;
  doc.y += 10;
}

function renderImage(doc: Doc, b: Extract<Block, { kind: "image" }>, t: BodyTheme) {
  try {
    const data = Buffer.from(b.src.slice(b.src.indexOf(",") + 1), "base64");
    const img = (doc as any).openImage(data) as { width: number; height: number };
    const maxW = contentWidth(doc);
    const maxH = Math.min(360, bottomLimit(doc) - doc.page.margins.top - 40);
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = img.width * scale;
    const h = img.height * scale;
    ensureSpace(doc, h + 30);
    doc.y += 6;
    doc.image(img as any, doc.page.margins.left + (maxW - w) / 2, doc.y, { width: w, height: h });
    doc.y += h + 4;
    const cap = b.caption?.length ? b.caption : b.alt ? [{ text: b.alt, italic: true }] : [];
    if (cap.length) writeRuns(doc, cap.map((r) => ({ ...r, italic: true })), t, { size: 9, align: "center", color: t.muted });
    doc.y += 8;
  } catch {
    /* unreadable image — leave it out rather than fail the galley */
  }
}

/** Typesets the manuscript body. Returns the number of blocks written. */
export function renderBody(doc: Doc, html: string, t: BodyTheme): number {
  let blocks = htmlToBlocks(html);
  // Skip leading blocks that repeat the title/abstract already set above.
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const skip = new Set((t.skipLeading ?? []).filter(Boolean).map(norm));
  while (blocks.length && blocks[0].kind !== "table" && blocks[0].kind !== "image" && blocks[0].kind !== "rule" && blocks[0].kind !== "code" && skip.has(norm(runsText((blocks[0] as any).runs ?? (blocks[0] as any).items?.[0]?.runs ?? [])))) {
    blocks = blocks.slice(1);
  }
  if (!blocks.length) return 0;

  let inReferences = false;
  let afterHeading = true;
  blocks.forEach((b, i) => {
    switch (b.kind) {
      case "heading": {
        inReferences = REFERENCE_HEADING.test(runsText(b.runs).trim());
        renderHeading(doc, b, t, i === 0);
        afterHeading = true;
        return;
      }
      case "para": {
        const text = runsText(b.runs);
        // A short, unpunctuated paragraph that reads as a section title
        // ("References", "2. Methods") is set as a heading.
        if (text.length < 90 && !/[.:;,?!]$/.test(text.trim()) && (REFERENCE_HEADING.test(text.trim()) || SECTION_NAME.test(text.trim()) || (SECTION_NUMBER.test(text.trim()) && text.split(/\s+/).length <= 10 && isTitleLike(text.trim().replace(SECTION_NUMBER, "")))) && b.runs.every((r) => !r.link)) {
          inReferences = REFERENCE_HEADING.test(text.trim());
          renderHeading(doc, { kind: "heading", level: 2, runs: b.runs }, t, i === 0);
          afterHeading = true;
          return;
        }
        if (inReferences) {
          // Hanging indent, smaller type, ragged right — the reference-list convention.
          const hang = 16;
          const w = contentWidth(doc) - hang;
          ensureSpace(doc, Math.min(measureRuns(doc, b.runs, t, w, 9.5), 9.5 * 3.5));
          writeRuns(doc, b.runs, t, { x: doc.page.margins.left + hang, width: w, size: 9.5, align: "left", indent: -hang, lineGap: 1.6 });
          doc.y += 4;
          return;
        }
        ensureSpace(doc, Math.min(measureRuns(doc, b.runs, t, contentWidth(doc), BODY_SIZE), BODY_SIZE * 2.6));
        writeRuns(doc, b.runs, t, { indent: afterHeading ? 0 : 14, align: "justify" });
        doc.y += 4;
        afterHeading = false;
        return;
      }
      case "list":
        if (inReferences && !b.ordered) {
          for (const it of b.items) {
            const hang = 16;
            ensureSpace(doc, 9.5 * 3);
            writeRuns(doc, it.runs, t, { x: doc.page.margins.left + hang, width: contentWidth(doc) - hang, size: 9.5, align: "left", indent: -hang, lineGap: 1.6 });
            doc.y += 4;
          }
        } else renderList(doc, b, t);
        afterHeading = false;
        return;
      case "table":
        renderTable(doc, b, t);
        afterHeading = true;
        return;
      case "quote": {
        const inset = 22;
        ensureSpace(doc, BODY_SIZE * 3);
        const y0 = doc.y;
        writeRuns(doc, b.runs, t, { x: doc.page.margins.left + inset, width: contentWidth(doc) - inset * 2, size: 10, align: "left", color: "#3d3550" });
        doc.save().moveTo(doc.page.margins.left + 8, y0).lineTo(doc.page.margins.left + 8, Math.max(doc.y, y0 + 10)).lineWidth(2).strokeColor(t.accent).stroke().restore();
        doc.y += 6;
        afterHeading = true;
        return;
      }
      case "code":
        ensureSpace(doc, 30);
        doc.font("Courier").fontSize(8.5).fillColor(t.ink).text(printable(b.text, t.fonts), doc.page.margins.left + 10, doc.y, { width: contentWidth(doc) - 20, lineGap: 1 });
        doc.y += 6;
        return;
      case "image":
        renderImage(doc, b, t);
        afterHeading = true;
        return;
      case "rule":
        ensureSpace(doc, 14);
        doc.y += 6;
        doc.save().moveTo(doc.page.margins.left + contentWidth(doc) * 0.35, doc.y).lineTo(doc.page.margins.left + contentWidth(doc) * 0.65, doc.y).lineWidth(0.6).strokeColor(t.accent).stroke().restore();
        doc.y += 8;
        return;
    }
  });
  doc.x = doc.page.margins.left;
  return blocks.length;
}
