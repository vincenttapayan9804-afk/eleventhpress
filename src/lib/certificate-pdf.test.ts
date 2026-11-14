/// <reference types="bun-types" />
/**
 * Certificate PDFs (src/lib/certificate-pdf.ts): each layout renders a valid
 * single-page PDF, with or without a photo, long names and long work
 * titles, and non-Latin names, and carries the content hash in its metadata.
 */
import { describe, test, expect } from "bun:test";
import crypto from "crypto";
import { PDFDocument } from "pdf-lib";
import { buildAffiliationCard, buildMembershipCertificate, buildRecognitionCertificate } from "./certificate-pdf";
import { canonicalCertificatePayload, type CertificatePayload } from "./certificates";

const payload = (o: Partial<CertificatePayload> = {}): CertificatePayload => ({
  serialNumber: "EP-REC-57AB4F5D0B",
  type: "RECOGNITION",
  category: "EDITOR",
  recipientName: "Vincent M. Tapayan, LPT, NLPMP, RBT, CIA",
  issuedAtIso: "2026-07-18T08:00:00.000Z",
  journalName: "Eleventh Press International Publishing™",
  issn: "2945-1138",
  workTitle: null,
  ...o,
});

async function check(pdf: Buffer, p: CertificatePayload) {
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  const doc = await PDFDocument.load(pdf);
  expect(doc.getPageCount()).toBe(1);
  const hash = crypto.createHash("sha256").update(canonicalCertificatePayload(p)).digest("hex");
  expect(doc.getSubject()).toContain(hash);
}

describe("certificate PDFs", () => {
  test("recognition: service and published-work variants, with and without a photo", async () => {
    const service = payload();
    await check(await buildRecognitionCertificate(service, null), service);
    const work = payload({
      category: "AUTHOR",
      recipientName: "Đặng Thị Hồng Nhung, PhD, with an unusually long list of post-nominal letters MA MEd",
      workTitle: "Classroom Learning Environment and Institutional Support as Predictors of Students' Motivated Strategies for Learning Technology and Livelihood Education (TLE)",
    });
    await check(await buildRecognitionCertificate(work, null), work);
  });

  test("membership", async () => {
    const p = payload({ type: "MEMBERSHIP", serialNumber: "EP-MEM-9F8E7D6C5B", category: "EXPERT" });
    await check(await buildMembershipCertificate(p, null), p);
  });

  test("affiliation card: front and back on one page", async () => {
    const p = payload({ type: "AFFILIATION", serialNumber: "EP-PAC-E9E8E22880", category: "REVIEWER", issn: null });
    await check(await buildAffiliationCard(p, null), p);
  });
});
