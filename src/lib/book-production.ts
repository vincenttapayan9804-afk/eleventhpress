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
import { buildEpub as buildEpubZip, type EpubChapter } from "@/lib/epub-builder";
import { parseAuthors } from "@/lib/article";
import { JOURNAL_IDENTITY } from "@/lib/site";
import { logoPngOf, publisherIdentityForTenantId, PLATFORM_ACCENT_HEX, PLATFORM_PRIMARY_HEX } from "@/lib/publisher-identity";
import { POWERED_BY_CREDIT } from "@/lib/powered-by";
import PDFDocument from "pdfkit";

interface Chapter {
  title: string;
  html: string;
}

function safeAuthorNames(authorsJson: string): string[] {
  return parseAuthors(authorsJson).map((a) => a.name).filter(Boolean);
}

/** Builds a real EPUB3 file: mimetype, container.xml, an OPF package
 * document, a nav (table of contents), and one XHTML file per chapter.
 * Thin wrapper over the shared src/lib/epub-builder.ts (also used by
 * src/lib/galley.ts for single-article EPUBs) that keeps this function's
 * existing `authors: string` (JSON) signature so no caller needs to change. */
export function buildEpub(
  book: { id: string; title: string; subtitle?: string | null; authors: string },
  chapters: Chapter[],
  brand?: BookBrand
): Buffer {
  return buildEpubZip(
    {
      id: book.id,
      title: book.title,
      subtitle: book.subtitle,
      authors: safeAuthorNames(book.authors),
      publisher: brand?.publisher,
      credit: brand?.whitelabel ? POWERED_BY_CREDIT : null,
    },
    chapters as EpubChapter[]
  );
}

const DEFAULT_MAROON = "#7A1F2B";
const DEFAULT_GOLD = "#c9a55c";
const BRAND_INK = "#2a1f1a";

/** The publishing tenant's identity for a book (absent = the platform's own). */
export interface BookBrand {
  publisher: string;
  whitelabel: boolean;
  primaryHex?: string;
  accentHex?: string;
  logoPng?: Buffer | null;
}

/** Print-ready PDF: cover page, table of contents, then each chapter's
 * plain-text body — same PDFKit renderer family as galley.ts's article PDFs. */
export function buildBookPdf(
  book: { title: string; subtitle?: string | null; authors: string },
  chapters: Chapter[],
  brand?: BookBrand
): Promise<Buffer> {
  const publisher = brand?.publisher || JOURNAL_IDENTITY.name;
  const BRAND_MAROON = brand?.whitelabel && brand.primaryHex ? brand.primaryHex : DEFAULT_MAROON;
  const BRAND_GOLD = brand?.whitelabel && brand.accentHex ? brand.accentHex : DEFAULT_GOLD;
  return new Promise((resolve, reject) => {
    try {
      const authorNames = safeAuthorNames(book.authors);
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 64, bottom: 56, left: 56, right: 56 },
        bufferPages: true,
        info: { Title: book.title, Author: authorNames.join(", "), ...(brand?.whitelabel ? { Creator: publisher, Producer: publisher } : {}) },
      });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Cover page — the publishing tenant's logo sits above its name.
      if (brand?.logoPng) {
        try {
          doc.image(brand.logoPng, doc.page.margins.left, doc.page.margins.top - 20, { fit: [120, 48] });
          doc.y = doc.page.margins.top + 36;
        } catch {
          /* unreadable logo — the publisher name below still identifies it */
        }
      }
      doc.fillColor(BRAND_GOLD).font("Helvetica-Bold").fontSize(9).text(publisher.toUpperCase());
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
        // Below-margin footer must not trigger an automatic page break.
        const pageBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.font("Helvetica").fontSize(7.5).fillColor(BRAND_MAROON).text(
          `${publisher} · Page ${i - range.start + 1}`,
          doc.page.margins.left,
          doc.page.height - pageBottom + 18,
          { align: "center", width: doc.page.width - doc.page.margins.left - doc.page.margins.right, lineBreak: false }
        );
        if (brand?.whitelabel) {
          // Fixed platform credit under the running footer.
          doc.font("Helvetica").fontSize(6.5).fillColor("#888888").text(
            POWERED_BY_CREDIT,
            doc.page.margins.left,
            doc.page.height - pageBottom + 30,
            { align: "center", width: doc.page.width - doc.page.margins.left - doc.page.margins.right, lineBreak: false }
          );
        }
        doc.page.margins.bottom = pageBottom;
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
    const brand = await bookBrandFor(book.tenantId);
    const epubBuffer = buildEpub(book, chapters, brand);
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await buildBookPdf(book, chapters, brand);
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

/** The publishing tenant's identity for a book, or undefined for the platform's own books. */
export async function bookBrandFor(tenantId: string | null | undefined): Promise<BookBrand | undefined> {
  const id = await publisherIdentityForTenantId(tenantId);
  if (!id.whitelabel) return undefined;
  return {
    publisher: id.publisher,
    whitelabel: true,
    // Only a colour the tenant actually set replaces the book palette.
    primaryHex: id.primaryHex !== PLATFORM_PRIMARY_HEX ? id.primaryHex : undefined,
    accentHex: id.accentHex !== PLATFORM_ACCENT_HEX ? id.accentHex : undefined,
    logoPng: await logoPngOf(id.logoUrl),
  };
}
