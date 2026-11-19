/**
 * Real EPUB3 builder — mimetype, container.xml, an OPF package document,
 * a nav (table of contents), and one XHTML file per chapter, packed via
 * src/lib/zip-writer.ts (pure JS, no native binaries). Originally lived
 * inside src/lib/book-production.ts for Book output; extracted here as a
 * standalone leaf module (no imports from galley.ts/book-production.ts)
 * so src/lib/galley.ts can also call it for a single-chapter article
 * EPUB without creating a circular import between the two.
 */
import { createHash } from "node:crypto";
import { buildZip, type ZipEntry } from "@/lib/zip-writer";
import { ARTICLE_LANGUAGE, JOURNAL_IDENTITY } from "@/lib/site";

export interface EpubChapter {
  title: string;
  html: string;
}

function escapeXml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&apos;";
      default: return c;
    }
  });
}

/**
 * Makes sanitized HTML safe inside an XHTML chapter: void elements closed,
 * HTML-only named entities turned into numeric ones (XML knows just five).
 */
export function toXhtml(html: string): string {
  const named: Record<string, number> = { nbsp: 160, ndash: 8211, mdash: 8212, hellip: 8230, lsquo: 8216, rsquo: 8217, ldquo: 8220, rdquo: 8221, copy: 169, reg: 174, trade: 8482, deg: 176, times: 215, plusmn: 177, middot: 183, micro: 181 };
  return html
    .replace(/<(br|hr|img|col|wbr)(\s[^>]*?)?\s*\/?>/gi, (_m, tag: string, attrs = "") => `<${tag.toLowerCase()}${attrs}/>`)
    .replace(/&([a-z]+);/gi, (m, name: string) => (["amp", "lt", "gt", "quot", "apos"].includes(name) ? m : named[name.toLowerCase()] ? `&#${named[name.toLowerCase()]};` : `&amp;${name};`));
}

/**
 * EPUB Accessibility 1.1 discovery metadata (schema.org accessibility
 * properties in the OPF). Library catalogues, Ace by DAISY and reading
 * systems show these to readers before they download. Claims are derived
 * from the real content: alternative text and the WCAG conformance claim are
 * only asserted when every image actually carries a non-empty alt.
 */
export function epubAccessibilityMetadata(chapters: EpubChapter[], certifier: string): string {
  const imgs = chapters.flatMap((c) => c.html.match(/<img\b[^>]*>/gi) ?? []);
  const hasImages = imgs.length > 0;
  const allAlt = imgs.every((tag) => /\balt\s*=\s*("[^"]*\S[^"]*"|'[^']*\S[^']*')/i.test(tag));
  const hasTables = chapters.some((c) => /<table\b/i.test(c.html));
  const hasMath = chapters.some((c) => /<math\b/i.test(c.html));

  const features = ["tableOfContents", "readingOrder", "structuralNavigation", "displayTransformability"];
  if (hasImages && allAlt) features.push("alternativeText");
  if (hasTables) features.push("table");
  if (hasMath) features.push("MathML");

  const lines = [
    `<meta property="schema:accessMode">textual</meta>`,
    ...(hasImages ? [`<meta property="schema:accessMode">visual</meta>`] : []),
    ...(!hasImages || allAlt ? [`<meta property="schema:accessModeSufficient">textual</meta>`] : []),
    ...(hasImages ? [`<meta property="schema:accessModeSufficient">textual,visual</meta>`] : []),
    ...features.map((f) => `<meta property="schema:accessibilityFeature">${f}</meta>`),
    `<meta property="schema:accessibilityHazard">none</meta>`,
    `<meta property="schema:accessibilitySummary">${escapeXml(
      !hasImages || allAlt
        ? "Reflowable text with a navigable table of contents, headings for every chapter and a logical reading order. Text can be resized and restyled, and every image has a text alternative. No flashing, sound or motion hazards."
        : "Reflowable text with a navigable table of contents, headings for every chapter and a logical reading order. Text can be resized and restyled. Some images do not yet have text alternatives. No flashing, sound or motion hazards."
    )}</meta>`,
  ];
  if (!hasImages || allAlt) {
    lines.push(
      `<meta property="dcterms:conformsTo">EPUB Accessibility 1.1 - WCAG 2.2 Level AA</meta>`,
      `<meta property="a11y:certifiedBy">${escapeXml(certifier)}</meta>`,
    );
  }
  return lines.map((l) => `    ${l}`).join("\n");
}

export function buildEpub(
  book: {
    id: string;
    title: string;
    subtitle?: string | null;
    authors: string[];
    rights?: string | null;
    /** Publishing organisation — the whitelabel tenant's name, or the platform's. */
    publisher?: string | null;
    /** Fixed platform credit for a whitelabel tenant's e-books (printed under the contents). */
    credit?: string | null;
    /** DOI, recorded as a second identifier. */
    doi?: string | null;
    /** Stylesheet shared by every chapter (OEBPS/style.css). */
    css?: string | null;
  },
  chapters: EpubChapter[]
): Buffer {
  const authorNames = book.authors.filter(Boolean);
  // urn:uuid needs a real UUID; derive a stable one from the id (name-based, v5-style).
  const h = createHash("sha1").update(`epip:${book.id}`).digest("hex");
  const uid = `urn:uuid:${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
  const cssLink = book.css ? `<link rel="stylesheet" type="text/css" href="style.css"/>` : "";
  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");

  const a11y = epubAccessibilityMetadata(chapters, book.publisher || JOURNAL_IDENTITY.name);

  const manifestItems = chapters
    .map((_, i) => `    <item id="chap${i + 1}" href="chapter-${i + 1}.xhtml" media-type="application/xhtml+xml"/>`)
    .join("\n");
  const spineItems = chapters.map((_, i) => `    <itemref idref="chap${i + 1}"/>`).join("\n");

  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" prefix="a11y: http://www.idpf.org/epub/vocab/package/a11y/#">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">${escapeXml(uid)}</dc:identifier>
    ${book.doi ? `<dc:identifier>doi:${escapeXml(book.doi)}</dc:identifier>` : ""}
    <dc:title>${escapeXml(book.title)}</dc:title>
    ${book.subtitle ? `<dc:description>${escapeXml(book.subtitle)}</dc:description>` : ""}
    <dc:language>${ARTICLE_LANGUAGE}</dc:language>
    <dc:publisher>${escapeXml(book.publisher || JOURNAL_IDENTITY.name)}</dc:publisher>
${authorNames.map((n) => `    <dc:creator>${escapeXml(n)}</dc:creator>`).join("\n")}
    ${book.rights ? `<dc:rights>${escapeXml(book.rights)}</dc:rights>` : ""}
    <meta property="dcterms:modified">${modified}</meta>
${a11y}
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/>
${book.css ? `    <item id="css" href="style.css" media-type="text/css"/>\n` : ""}${manifestItems}
  </manifest>
  <spine>
${spineItems}
  </spine>
</package>
`;

  const navItems = chapters.map((c, i) => `      <li><a href="chapter-${i + 1}.xhtml">${escapeXml(c.title)}</a></li>`).join("\n");
  const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${ARTICLE_LANGUAGE}" lang="${ARTICLE_LANGUAGE}">
<head><title>Table of Contents</title>${cssLink}</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>${escapeXml(book.title)}</h1>
    <ol>
${navItems}
    </ol>
  </nav>${book.credit ? `
  <p style="margin-top:2em;font-size:0.75em;color:#666;text-align:center;">${escapeXml(book.publisher || "")}${book.publisher ? " · " : ""}${escapeXml(book.credit)}</p>` : ""}
</body>
</html>
`;

  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`;

  const entries: ZipEntry[] = [
    { name: "mimetype", data: Buffer.from("application/epub+zip", "ascii") },
    { name: "META-INF/container.xml", data: Buffer.from(containerXml, "utf-8") },
    { name: "OEBPS/content.opf", data: Buffer.from(contentOpf, "utf-8") },
    { name: "OEBPS/nav.xhtml", data: Buffer.from(navXhtml, "utf-8") },
    ...(book.css ? [{ name: "OEBPS/style.css", data: Buffer.from(book.css, "utf-8") }] : []),
    ...chapters.map((c, i) => ({
      name: `OEBPS/chapter-${i + 1}.xhtml`,
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${ARTICLE_LANGUAGE}" lang="${ARTICLE_LANGUAGE}"><head><meta charset="utf-8"/><title>${escapeXml(c.title)}</title>${cssLink}</head><body><h1>${escapeXml(c.title)}</h1>${toXhtml(c.html)}</body></html>\n`,
        "utf-8"
      ),
    })),
  ];

  return buildZip(entries);
}
