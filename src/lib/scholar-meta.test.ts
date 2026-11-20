import { describe, expect, test } from "bun:test";
import { articlePdfPath, scholarDate } from "./scholar-meta";

describe("scholarDate", () => {
  test("formats as YYYY/MM/DD in UTC", () => {
    expect(scholarDate(new Date("2026-11-05T23:30:00Z"))).toBe("2026/11/05");
    expect(scholarDate("2024-01-31T00:00:00.000Z")).toBe("2024/01/31");
  });
  test("returns null for missing or invalid dates", () => {
    expect(scholarDate(null)).toBeNull();
    expect(scholarDate("not a date")).toBeNull();
  });
});

describe("articlePdfPath", () => {
  test("puts fulltext.pdf under the article page's path", () => {
    expect(articlePdfPath("/article/my-title--abc123")).toBe("/article/my-title--abc123/fulltext.pdf");
    expect(articlePdfPath("/article/x--y/")).toBe("/article/x--y/fulltext.pdf");
  });
});
