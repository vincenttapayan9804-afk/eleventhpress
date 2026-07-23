/// <reference types="bun-types" />
/**
 * Tests for the CSV/Excel export helpers (src/lib/table-export.ts).
 * Only the pure data-shaping (buildCsvString/buildExcelBuffer) is
 * exercised here — triggerDownload/exportTableTo* need a real DOM
 * (document.createElement, URL.createObjectURL) and are thin wrappers
 * with no logic of their own.
 */
import { describe, test, expect } from "bun:test";
import { buildCsvString, buildExcelBuffer, toAoa } from "@/lib/table-export";

const TABLE = {
  headers: ["City", "Retention %"],
  rows: [
    ["Auckland", "89"],
    ["Singapore", "76"],
    ["Lagos, NG", "61"],
  ],
};

describe("toAoa", () => {
  test("prepends headers as the first row", () => {
    expect(toAoa(TABLE)).toEqual([
      ["City", "Retention %"],
      ["Auckland", "89"],
      ["Singapore", "76"],
      ["Lagos, NG", "61"],
    ]);
  });
});

describe("buildCsvString", () => {
  test("produces real CSV with headers and quoted fields containing commas", async () => {
    const csv = await buildCsvString(TABLE);
    const lines = csv.trim().split(/\r?\n/);
    expect(lines[0]).toBe("City,Retention %");
    expect(lines).toContain('"Lagos, NG",61');
  });
});

describe("buildExcelBuffer", () => {
  test("produces a real, non-empty XLSX (ZIP) buffer", async () => {
    const buffer = await buildExcelBuffer(TABLE);
    expect(buffer.byteLength).toBeGreaterThan(100);
    const bytes = new Uint8Array(buffer, 0, 2);
    expect(bytes[0]).toBe(0x50); // "P" — ZIP local file header (xlsx is a ZIP container)
    expect(bytes[1]).toBe(0x4b); // "K"
  });
});
