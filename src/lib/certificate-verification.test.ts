/// <reference types="bun-types" />
import { describe, test, expect, mock, afterAll } from "bun:test";
import { PDFDocument } from "pdf-lib";

/**
 * Certificate verification (src/lib/certificate-verification-record.ts and
 * its PDF report): the verdict comes from re-hashing the stored record, a
 * tampered row is reported as a mismatch, and the report renders.
 */
type DbModule = typeof import("@/lib/db");
const realDb = (await import("./db.ts?real=certificate-verification-test" as string)) as DbModule;

let active = false;
let row: any = null;
mock.module("@/lib/db", () => ({
  ...realDb,
  db: new Proxy(realDb.db as object, {
    get(target, prop, receiver) {
      if (active && prop === "certificate") return { findUnique: async () => (row ? { ...row } : null) };
      if (active && prop === "auditLog")
        return { findMany: async () => [{ action: "CERTIFICATE_ISSUED", createdAt: new Date("2026-07-18T08:00:00Z") }, { action: "CERTIFICATE_REGENERATED", createdAt: new Date("2026-09-01T10:00:00Z") }] };
      return Reflect.get(target, prop, receiver);
    },
  }),
}));

const { loadCertificateRecord, certificatePayloadFromRow } = await import("./certificate-verification-record");
const { computeContentHash } = await import("./certificates-server");
const { buildCertificateVerificationPdf, certificateVerificationFileName } = await import("./certificate-verification-pdf");

function makeRow(overrides: Record<string, unknown> = {}) {
  const base = {
    id: "cert_1",
    serialNumber: "EP-REC-57AB4F5D0B",
    type: "RECOGNITION",
    category: "EDITOR",
    recipientName: "Vincent M. Tapayan, LPT",
    issuedAt: new Date("2026-07-18T08:00:00Z"),
    journalName: "Eleventh Press International Publishing™",
    issn: "2945-1138",
    workTitle: null,
    templateVersion: 3,
    ...overrides,
  };
  return { ...base, contentHash: computeContentHash(certificatePayloadFromRow(base as any)) };
}

afterAll(() => {
  active = false;
});

describe("loadCertificateRecord", () => {
  test("an untouched certificate verifies, with labels, checks and a timeline", async () => {
    active = true;
    row = makeRow();
    const r = await loadCertificateRecord("EP-REC-57AB4F5D0B");
    expect(r.kind).toBe("found");
    if (r.kind !== "found") return;
    expect(r.record.verdict).toBe("verified");
    expect(r.record.checks).toEqual({ located: true, payload: true, serial: true });
    expect(r.record.typeLabel).toBe("Certificate of Recognition");
    expect(r.record.categoryLabel).toBe("Board of Editors Member");
    expect(r.record.recomputedHash).toBe(r.record.contentHash);
    expect(r.record.timeline.map((e) => e.kind)).toEqual(["issued", "regenerated", "verified"]);
    expect(r.record.urls.report).toContain("/api/certificates/verify/EP-REC-57AB4F5D0B/report");
  });

  test("a row altered after issuance (e.g. a changed name) is a mismatch", async () => {
    active = true;
    row = { ...makeRow(), recipientName: "Someone Else" };
    const r = await loadCertificateRecord("EP-REC-57AB4F5D0B");
    expect(r.kind === "found" && r.record.verdict).toBe("mismatch");
    expect(r.kind === "found" && r.record.checks.payload).toBe(false);
  });

  test("an unknown serial is not found", async () => {
    active = true;
    row = null;
    expect((await loadCertificateRecord("EP-REC-NOPE")).kind).toBe("not-found");
  });
});

describe("buildCertificateVerificationPdf", () => {
  test("renders a valid PDF for both verdicts, including non-Latin names", async () => {
    active = true;
    for (const tampered of [false, true]) {
      row = makeRow({ recipientName: "Đặng Thị Hồng, PhD", workTitle: "A Study of Learning — “TLE”" });
      if (tampered) row.recipientName = "Changed";
      const r = await loadCertificateRecord(row.serialNumber);
      if (r.kind !== "found") throw new Error("not found");
      const pdf = await buildCertificateVerificationPdf(r.record);
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      const parsed = await PDFDocument.load(pdf);
      expect(parsed.getPageCount()).toBeGreaterThanOrEqual(1);
      expect(certificateVerificationFileName(r.record)).toBe("certificate-verification-ep-rec-57ab4f5d0b.pdf");
    }
  });
});
