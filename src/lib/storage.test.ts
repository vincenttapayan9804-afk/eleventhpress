/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import path from "path";
import { resolveWithinBucket, safeManuscriptFilename } from "@/lib/storage";

describe("resolveWithinBucket", () => {
  const bucketDir = path.join("/tmp", "epip-test-bucket");

  test("allows a plain relative path inside the bucket", () => {
    const result = resolveWithinBucket(bucketDir, "abc123.pdf");
    expect(result).toBe(path.join(bucketDir, "abc123.pdf"));
  });

  test("allows a nested relative path inside the bucket", () => {
    const result = resolveWithinBucket(bucketDir, "user1/manuscript.pdf");
    expect(result).toBe(path.join(bucketDir, "user1/manuscript.pdf"));
  });

  test("blocks a path that escapes the bucket via ../", () => {
    const result = resolveWithinBucket(bucketDir, "../../../etc/passwd");
    expect(result).toBeNull();
  });

  test("blocks a single-segment .. traversal", () => {
    const result = resolveWithinBucket(bucketDir, "..");
    expect(result).toBeNull();
  });

  test("blocks a path that escapes after a legitimate-looking prefix", () => {
    const result = resolveWithinBucket(bucketDir, "user1/../../other-bucket/secret.pdf");
    expect(result).toBeNull();
  });
});

describe("safeManuscriptFilename", () => {
  test("keeps a normal extension", () => {
    expect(safeManuscriptFilename("my-paper.pdf", "12345")).toBe("12345.pdf");
  });

  test("lowercases the extension", () => {
    expect(safeManuscriptFilename("Thesis.DOCX", "12345")).toBe("12345.docx");
  });

  test("falls back to pdf when the original name has no usable extension", () => {
    expect(safeManuscriptFilename("../../../etc/passwd", "12345")).toBe("12345.pdf");
  });

  test("falls back to pdf when the 'extension' contains path separators", () => {
    expect(safeManuscriptFilename("evil/../../other-user/file", "12345")).toBe("12345.pdf");
  });

  test("falls back to pdf when the extension is implausibly long", () => {
    expect(safeManuscriptFilename(`file.${"a".repeat(50)}`, "12345")).toBe("12345.pdf");
  });

  test("never lets the client-supplied name appear in the result", () => {
    const result = safeManuscriptFilename("../../secrets/../../evil.sh", "12345");
    expect(result).not.toContain("secrets");
    expect(result).not.toContain("evil");
    expect(result).not.toContain("..");
  });
});
