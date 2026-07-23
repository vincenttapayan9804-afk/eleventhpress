/**
 * Magazine issue production — compiles an issue's MagazinePiece rows (in
 * `order`) into a real EPUB3 and a print-ready PDF, the same renderer
 * family src/lib/book-production.ts uses for Book (src/lib/epub-builder.ts
 * for the EPUB, PDFKit for the PDF) — no new rendering code, just a
 * different content source: an issue's pieces instead of a book's chapters.
 *
 * The job-queue shape (atomic claim, sweep, retry) is a direct mirror of
 * src/lib/book-production.ts/src/lib/galley-job.ts — same durability
 * guarantee, same reasoning, just against MagazineIssueProductionJob/
 * MagazineIssue instead of BookProductionJob/Book.
 */
import { db } from "@/lib/db";
import { putObject } from "@/lib/storage";
import { escapeXml, htmlToPlainText, renderMinimalErrorPdf } from "@/lib/galley";
import { buildEpub as buildEpubZip, type EpubChapter } from "@/lib/epub-builder";
import PDFDocument from "pdfkit";

interface Piece {
  title: string;
  html: string;
}

function issueDisplayTitle(issue: { title: string | null; volume: number; issueNumber: number; year: number }): string {
  return issue.title || `Vol. ${issue.volume}, No. ${issue.issueNumber} (${issue.year})`;
}

/** Builds a real EPUB3 file: one XHTML file per piece, same builder as Book. */
export function buildMagazineEpub(
  issue: { id: string; title: string | null; volume: number; issueNumber: number; year: number },
  magazineName: string,
  pieces: Piece[]
): Buffer {
  return buildEpubZip(
    { id: issue.id, title: `${magazineName} — ${issueDisplayTitle(issue)}`, subtitle: null, authors: [magazineName] },
    pieces as EpubChapter[]
  );
}

const BRAND_MAROON = "#7A1F2B";
const BRAND_GOLD = "#c9a55c";
const BRAND_INK = "#2a1f1a";

/** Print-ready PDF: cover page, table of contents, then each piece's plain-text body. */
export function buildMagazinePdf(
  issue: { title: string | null; volume: number; issueNumber: number; year: number },
  magazineName: string,
  pieces: Piece[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const displayTitle = issueDisplayTitle(issue);
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 64, bottom: 56, left: 56, right: 56 },
        bufferPages: true,
        info: { Title: `${magazineName} — ${displayTitle}`, Author: magazineName },
      });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Cover page
      doc.fillColor(BRAND_GOLD).font("Helvetica-Bold").fontSize(9).text(magazineName.toUpperCase());
      doc.moveDown(3);
      doc.fillColor(BRAND_MAROON).font("Helvetica-Bold").fontSize(26).text(displayTitle, { align: "center" });

      // Table of contents
      doc.addPage();
      doc.fillColor(BRAND_MAROON).font("Helvetica-Bold").fontSize(16).text("In This Issue");
      doc.moveDown();
      pieces.forEach((p, i) => {
        doc.fillColor(BRAND_INK).font("Helvetica").fontSize(11).text(`${i + 1}. ${p.title}`);
        doc.moveDown(0.3);
      });

      // Pieces
      for (const [i, p] of pieces.entries()) {
        doc.addPage();
        doc.fillColor(BRAND_GOLD).font("Helvetica-Bold").fontSize(8).text(`PIECE ${i + 1}`);
        doc.moveDown(0.2);
        doc.fillColor(BRAND_MAROON).font("Helvetica-Bold").fontSize(18).text(p.title);
        doc.moveDown(0.8);
        const bodyText = htmlToPlainText(p.html, [p.title]);
        doc.fillColor(BRAND_INK).font("Helvetica").fontSize(10).text(bodyText || "", { align: "left" });
      }

      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.font("Helvetica").fontSize(7.5).fillColor(BRAND_MAROON).text(
          `${magazineName} · Page ${i - range.start + 1}`,
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

/**
 * Runs a single MagazineIssueProductionJob to completion (or failure).
 * Mirrors runBookProductionJob's atomic-claim/retry-safe shape exactly.
 */
export async function runMagazineIssueProductionJob(
  jobId: string,
  triggeredBy: string | null = null,
  claimFilter: Record<string, unknown> = {}
): Promise<void> {
  const claimed = await db.magazineIssueProductionJob.updateMany({
    where: { id: jobId, ...claimFilter },
    data: { status: "PROCESSING", startedAt: new Date(), errorMessage: null },
  });
  if (claimed.count !== 1) return;

  const job = await db.magazineIssueProductionJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const issue = await db.magazineIssue.findUnique({
    where: { id: job.issueId },
    include: { magazine: true, pieces: { orderBy: { order: "asc" } } },
  });
  if (!issue) {
    await db.magazineIssueProductionJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: "Issue no longer exists", completedAt: new Date() },
    });
    return;
  }

  try {
    const pieces: Piece[] = issue.pieces.length
      ? issue.pieces.map((p) => ({ title: p.title, html: p.bodyHtml || `<p>${escapeXml(p.dek || "")}</p>` }))
      : [{ title: issueDisplayTitle(issue), html: "<p>This issue has no pieces yet.</p>" }];

    const epubBuffer = buildMagazineEpub(issue, issue.magazine.name, pieces);
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await buildMagazinePdf(issue, issue.magazine.name, pieces);
    } catch {
      pdfBuffer = await renderMinimalErrorPdf({ title: issueDisplayTitle(issue) });
    }

    const epubKey = `published-galleys/magazine-issue-${issue.id}.epub`;
    const pdfKey = `published-galleys/magazine-issue-${issue.id}.pdf`;
    await putObject(epubKey, epubBuffer, "application/epub+zip");
    await putObject(pdfKey, pdfBuffer, "application/pdf");

    await db.magazineIssue.update({
      where: { id: issue.id },
      data: { epubKey, pdfKey },
    });

    await db.magazineIssueProductionJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        epubKey,
        pdfKey,
        workerLog: JSON.stringify([`Built EPUB (${epubBuffer.length} bytes) and PDF (${pdfBuffer.length} bytes) from ${pieces.length} piece(s)`]),
        completedAt: new Date(),
      },
    });

    await db.auditLog.create({
      data: {
        userId: triggeredBy,
        action: "MAGAZINE_ISSUE_PRODUCED",
        entityType: "MAGAZINE_ISSUE",
        entityId: issue.id,
        metadata: JSON.stringify({ epubKey, pdfKey, jobId, trigger: triggeredBy ? "manual" : "system" }),
      },
    });
  } catch (e: any) {
    await db.magazineIssueProductionJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: e.message, completedAt: new Date() },
    });
  }
}

/** Batch entry point for a cron sweep, mirroring sweepStuckBookProductionJobs. */
export async function sweepStuckMagazineIssueProductionJobs(limit = 5, staleMinutes = 10): Promise<{ swept: number; jobIds: string[] }> {
  const staleCutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
  const stuck = await db.magazineIssueProductionJob.findMany({
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
    await runMagazineIssueProductionJob(job.id, null, {
      OR: [{ status: "QUEUED" }, { status: "PROCESSING", startedAt: { lt: staleCutoff } }],
    });
  }

  return { swept: stuck.length, jobIds: stuck.map((j) => j.id) };
}
