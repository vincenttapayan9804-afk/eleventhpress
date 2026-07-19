/**
 * Real EPUB3 builder — mimetype, container.xml, an OPF package document,
 * a nav (table of contents), and one XHTML file per chapter, packed via
 * src/lib/zip-writer.ts (pure JS, no native binaries). Originally lived
 * inside src/lib/book-production.ts for Book output; extracted here as a
 * standalone leaf module (no imports from galley.ts/book-production.ts)
 * so src/lib/galley.ts can also call it for a single-chapter article
 * EPUB without creating a circular import between the two.
 */
import { buildZip, type ZipEntry } from "@/lib/zip-writer";
import { ARTICLE_LANGUAGE } from "@/lib/site";

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

export function buildEpub(
  book: { id: string; title: string; subtitle?: string | null; authors: string[]; rights?: string | null },
  chapters: EpubChapter[]
): Buffer {
  const authorNames = book.authors.filter(Boolean);
  const uid = `urn:uuid:epip-${book.id}`;
  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");

  const manifestItems = chapters
    .map((_, i) => `    <item id="chap${i + 1}" href="chapter-${i + 1}.xhtml" media-type="application/xhtml+xml"/>`)
    .join("\n");
  const spineItems = chapters.map((_, i) => `    <itemref idref="chap${i + 1}"/>`).join("\n");

  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">${escapeXml(uid)}</dc:identifier>
    <dc:title>${escapeXml(book.title)}</dc:title>
    ${book.subtitle ? `<dc:description>${escapeXml(book.subtitle)}</dc:description>` : ""}
    <dc:language>${ARTICLE_LANGUAGE}</dc:language>
    <dc:publisher>Eleventh Press International Publishing</dc:publisher>
${authorNames.map((n) => `    <dc:creator>${escapeXml(n)}</dc:creator>`).join("\n")}
    ${book.rights ? `<dc:rights>${escapeXml(book.rights)}</dc:rights>` : ""}
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/>
${manifestItems}
  </manifest>
  <spine>
${spineItems}
  </spine>
</package>
`;

  const navItems = chapters.map((c, i) => `      <li><a href="chapter-${i + 1}.xhtml">${escapeXml(c.title)}</a></li>`).join("\n");
  const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Table of Contents</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>${escapeXml(book.title)}</h1>
    <ol>
${navItems}
    </ol>
  </nav>
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
    ...chapters.map((c, i) => ({
      name: `OEBPS/chapter-${i + 1}.xhtml`,
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapeXml(c.title)}</title></head><body><h1>${escapeXml(c.title)}</h1>${c.html}</body></html>\n`,
        "utf-8"
      ),
    })),
  ];

  return buildZip(entries);
}
