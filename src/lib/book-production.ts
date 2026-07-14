/**
 * Book production — generates a real EPUB3 (via src/lib/zip-writer.ts, pure
 * JS, no native binaries) and a print-ready PDF (via PDFKit, same renderer
 * family as src/lib/galley.ts's article galleys) from a Book's content.
 *
 * Two content sources, chosen by Book.format:
 *   - MONOGRAPH: a single uploaded manuscript (Book.manuscriptKey),
 *     extracted the same way an article manuscript is (reuses
 *     extractManuscriptBody from galley.ts rather than re-implementing
 *     DOCX/PDF/Markdown parsing).
 *   - EDITED_VOLUME / ANTHOLOGY: one chapter per linked BookArticle, in
 *     chapterOrder — each chapter's content is that article's own
 *     already-generated galleyHtmlKey, so compiling a book from existing
 *     published articles needs no new extraction step at all.
 *
 * The job-queue shape (atomic claim, sweep, retry) is a direct mirror of
 * src/lib/galley-job.ts — same durability guarantee, same reasoning, just
 * against BookProductionJob/Book instead of GalleyJob/Article.
 */
import { db } from "@/lib/db";
import { getObject, putObject } from "@/lib/storage";
import { extractManuscriptBody, escapeXml, htmlToPlainText, renderMinimalErrorPdf } from "@/lib/galley";
import { buildZip, type ZipEntry } from "@/lib/zip-writer";
import { parseAuthors } from "@/lib/article";
import PDFDocument from "pdfkit";

interface Chapter {
  title: string;
  html: string;
}

function safeAuthorNames(authorsJson: string): string[] {
  return parseAuthors(authorsJson).map((a) => a.name).filter(Boolean);
}

/** Builds a real EPUB3 file: mimetype, container.xml, an OPF package
 * document, a nav (table of contents), and one XHTML file per chapter. */
export function buildEpub(book: { id: string; title: string; subtitle?: string | null; authors: string }, chapters: Chapter[]): Buffer {
  const authorNames = safeAuthorNames(book.authors);
  const uid = `urn:uuid:epip-book-${book.id}`;
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
    <dc:language>en</dc:language>
    <dc:publisher>Eleventh Press International Publishing</dc:publisher>
${authorNames.map((n) => `    <dc:creator>${escapeXml(n)}</dc:creator>`).join("\n")}
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

const BRAND_MAROON = "#7A1F2B";
const BRAND_GOLD = "#c9a55c";
const BRAND_INK = "#2a1f1a";

/** Print-ready PDF: cover page, table of contents, then each chapter's
 * plain-text body — same PDFKit renderer family as galley.ts's article PDFs. */
export function buildBookPdf(book: { title: string; subtitle?: string | null; authors: string }, chapters: Chapter[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const authorNames = safeAuthorNames(book.authors);
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 64, bottom: 56, left: 56, right: 56 },
        bufferPages: true,
        info: { Title: book.title, Author: authorNames.join(", ") },
      });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Cover page
      doc.fillColor(BRAND_GOLD).font("Helvetica-Bold").fontSize(9).text("ELEVENTH PRESS INTERNATIONAL PUBLISHING");
      doc.moveDown(3);
      doc.fillColor(BRAND_MAROON).font("Helvetica-Bold").fontSize(26).text(book.title, { align: "center" });
      if (book.subtitle) {
        doc.moveDown(0.5);
        doc.fillColor(BRAND_INK).font("Helvetica-Oblique").fontSize(14).text(book.subtitle, { align: "center" });
      }
      doc.moveDown(2);
      if (authorNames.length) {
        doc.fillColor(BRAND_INK).font("Helvetica").fontSize(12).text(authorNames.join(", "), { align: "center" });
      }

      // Table of contents
      doc.addPage();
      doc.fillColor(BRAND_MAROON).font("Helvetica-Bold").fontSize(16).text("Table of Contents");
      doc.moveDown();
      chapters.forEach((c, i) => {
        doc.fillColor(BRAND_INK).font("Helvetica").fontSize(11).text(`${i + 1}. ${c.title}`);
        doc.moveDown(0.3);
      });

      // Chapters
      for (const [i, c] of chapters.entries()) {
        doc.addPage();
        doc.fillColor(BRAND_GOLD).font("Helvetica-Bold").fontSize(8).text(`CHAPTER ${i + 1}`);
        doc.moveDown(0.2);
        doc.fillColor(BRAND_MAROON).font("Helvetica-Bold").fontSize(18).text(c.title);
        doc.moveDown(0.8);
        const bodyText = htmlToPlainText(c.html, [c.title]);
        doc.fillColor(BRAND_INK).font("Helvetica").fontSize(10).text(bodyText || "", { align: "left" });
      }

      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.font("Helvetica").fontSize(7.5).fillColor(BRAND_MAROON).text(
          `Eleventh Press International Publishing · Page ${i - range.start + 1}`,
          doc.page.margins.left,
          doc.page.height - doc.page.margins.bottom + 18,
          { align: "center", width: doc.page.width - doc.page.margins.left - doc.page.margins.right }
        );
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

async function resolveChapters(book: any): Promise<Chapter[]> {
  if (book.format === "MONOGRAPH") {
    if (book.manuscriptKey) {
      const bytes = await getObject(book.manuscriptKey);
      if (bytes) {
        const filename = book.manuscriptKey.split("/").pop() || "manuscript.md";
        const html = await extractManuscriptBody(bytes, filename);
        if (html) return [{ title: book.title, html }];
      }
    }
    return [{ title: book.title, html: `<p>${escapeXml(book.description)}</p>` }];
  }

  // EDITED_VOLUME / ANTHOLOGY — one chapter per linked article, already-published content
  const links = await db.bookArticle.findMany({
    where: { bookId: book.id },
    orderBy: { chapterOrder: "asc" },
    include: { article: true },
  });
  const chapters: Chapter[] = [];
  for (const link of links) {
    const article = link.article;
    let html: string | null = null;
    if (article.galleyHtmlKey) {
      const bytes = await getObject(article.galleyHtmlKey);
      if (bytes) {
        // The stored galley is a full standalone HTML document — the body's
        // inner content is what belongs inside this chapter's own <body>.
        const full = bytes.toString("utf-8");
        const match = full.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        html = match ? match[1] : full;
      }
    }
    chapters.push({ title: article.title, html: html || `<p>${escapeXml(article.abstract)}</p>` });
  }
  return chapters;
}

/**
 * Runs a single BookProductionJob to completion (or failure). Mirrors
 * runGalleyJob's atomic-claim/retry-safe shape exactly.
 */
export async function runBookProductionJob(
  jobId: string,
  triggeredBy: string | null = null,
  claimFilter: Record<string, unknown> = {}
): Promise<void> {
  const claimed = await db.bookProductionJob.updateMany({
    where: { id: jobId, ...claimFilter },
    data: { status: "PROCESSING", startedAt: new Date(), errorMessage: null },
  });
  if (claimed.count !== 1) return;

  const job = await db.bookProductionJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const book = await db.book.findUnique({ where: { id: job.bookId } });
  if (!book) {
    await db.bookProductionJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: "Book no longer exists", completedAt: new Date() },
    });
    return;
  }

  try {
    const chapters = await resolveChapters(book);
    const epubBuffer = buildEpub(book, chapters);
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await buildBookPdf(book, chapters);
    } catch {
      pdfBuffer = await renderMinimalErrorPdf({ title: book.title });
    }

    const epubKey = `published-galleys/book-${book.id}.epub`;
    const pdfKey = `published-galleys/book-${book.id}.pdf`;
    await putObject(epubKey, epubBuffer, "application/epub+zip");
    await putObject(pdfKey, pdfBuffer, "application/pdf");

    await db.book.update({
      where: { id: book.id },
      data: { epubKey, pdfKey },
    });

    await db.bookProductionJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        epubKey,
        pdfKey,
        workerLog: JSON.stringify([`Built EPUB (${epubBuffer.length} bytes) and PDF (${pdfBuffer.length} bytes) from ${chapters.length} chapter(s)`]),
        completedAt: new Date(),
      },
    });

    await db.auditLog.create({
      data: {
        userId: triggeredBy,
        action: "BOOK_PRODUCED",
        entityType: "BOOK",
        entityId: book.id,
        metadata: JSON.stringify({ epubKey, pdfKey, jobId, trigger: triggeredBy ? "manual" : "system" }),
      },
    });
  } catch (e: any) {
    await db.bookProductionJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: e.message, completedAt: new Date() },
    });
  }
}

/** Batch entry point for a cron sweep, mirroring sweepStuckGalleyJobs. */
export async function sweepStuckBookProductionJobs(limit = 5, staleMinutes = 10): Promise<{ swept: number; jobIds: string[] }> {
  const staleCutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
  const stuck = await db.bookProductionJob.findMany({
    where: {
      OR: [
        { status: "QUEUED" },
        { status: "PROCESSING", startedAt: { lt: staleCutoff } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  for (const job of stuck) {
    await runBookProductionJob(job.id, null, {
      OR: [{ status: "QUEUED" }, { status: "PROCESSING", startedAt: { lt: staleCutoff } }],
    });
  }

  return { swept: stuck.length, jobIds: stuck.map((j) => j.id) };
}
