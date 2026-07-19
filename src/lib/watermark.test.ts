/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { PDFDocument } from "pdf-lib";
import { stampPdf, stampEpub, type DownloadStamp } from "@/lib/watermark";
import { buildEpub } from "@/lib/epub-builder";
import { unzip } from "@/lib/zip-writer";

const STAMP: DownloadStamp = {
  downloadId: "dl_test123",
  label: "Ada Lovelace",
  timestampLabel: "19 July 2026",
  doi: "10.52011/epip.2024.001",
  verifyUrl: "https://example.org/verify/article/abc",
};

describe("stampPdf", () => {
  test("embeds download id and DOI in PDF metadata, page count unchanged", async () => {
    const original = await PDFDocument.create();
    original.addPage([200, 200]);
    original.addPage([200, 200]);
    const originalBytes = Buffer.from(await original.save());

    const stamped = await stampPdf(originalBytes, STAMP);
    const stampedDoc = await PDFDocument.load(stamped);

    expect(stampedDoc.getPageCount()).toBe(2);
    expect(stampedDoc.getSubject()).toContain(STAMP.downloadId);
    expect(stampedDoc.getSubject()).toContain(STAMP.doi!);
    expect(stampedDoc.getKeywords()).toContain(STAMP.downloadId);
  });
});

describe("stampEpub", () => {
  test("injects dc:rights + provenance meta into content.opf and a banner into chapter-1", () => {
    const epub = buildEpub({ id: "article-1", title: "Title", subtitle: null, authors: ["Ada Lovelace"] }, [
      { title: "Title", html: "<p>Body</p>" },
    ]);
    const stamped = stampEpub(epub, STAMP);

    const entries = unzip(stamped);
    const opf = entries.find((e) => e.name === "OEBPS/content.opf")!.data.toString("utf-8");
    expect(opf).toContain("dc:rights");
    expect(opf).toContain(STAMP.downloadId);
    expect(opf).toContain(STAMP.doi!);

    const chapter = entries.find((e) => e.name === "OEBPS/chapter-1.xhtml")!.data.toString("utf-8");
    expect(chapter).toContain(STAMP.downloadId);
    expect(chapter).toContain("<p>Body</p>"); // original content preserved
  });
});
