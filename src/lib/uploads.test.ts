/// <reference types="bun-types" />
/**
 * validateUploadBytes() (src/lib/uploads.ts) — the real enforcement point
 * for size caps and magic-byte content sniffing, used by
 * src/app/api/storage/upload-local/[token]/route.ts. Before this file,
 * that route had no size cap at all and never inspected the actual bytes,
 * trusting the client-supplied Content-Type outright.
 */
import { describe, test, expect } from "bun:test";
import { validateUploadBytes, BUCKET_UPLOAD_RULES } from "@/lib/uploads";

const PDF_HEADER = Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj", "latin1");
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const GIF_HEADER = Buffer.from("GIF89a" + "\0".repeat(10), "latin1");
const WEBP_HEADER = Buffer.concat([
  Buffer.from("RIFF", "latin1"),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from("WEBP", "latin1"),
]);
const DOCX_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
const DOC_HEADER = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
const EXE_HEADER = Buffer.from("MZ\x90\x00\x03\x00\x00\x00", "latin1"); // Windows PE executable
const MP3_ID3_HEADER = Buffer.from("ID3\x03\x00\x00\x00\x00\x00\x00", "latin1");
const MP3_FRAME_SYNC_HEADER = Buffer.from([0xff, 0xfb, 0x90, 0x00]); // tagless MP3, raw frame sync

describe("validateUploadBytes — size caps", () => {
  test("rejects an empty body", () => {
    const result = validateUploadBytes("avatars", "image/png", Buffer.alloc(0));
    expect(result.ok).toBe(false);
  });

  test("rejects a body over the bucket's max size", () => {
    const oversized = Buffer.concat([PNG_HEADER, Buffer.alloc(BUCKET_UPLOAD_RULES.avatars.maxSizeBytes)]);
    const result = validateUploadBytes("avatars", "image/png", oversized);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(413);
  });

  test("accepts a body within the bucket's max size", () => {
    const result = validateUploadBytes("avatars", "image/png", PNG_HEADER);
    expect(result.ok).toBe(true);
  });

  test("rejects an unknown bucket", () => {
    const result = validateUploadBytes("not-a-real-bucket", "image/png", PNG_HEADER);
    expect(result.ok).toBe(false);
  });

  test("rejects a content type not in the bucket's allowlist", () => {
    const result = validateUploadBytes("book-covers", "application/pdf", PDF_HEADER);
    expect(result.ok).toBe(false);
  });
});

describe("validateUploadBytes — magic-byte sniffing", () => {
  test.each([
    ["raw-submissions", "application/pdf", PDF_HEADER],
    ["avatars", "image/jpeg", JPEG_HEADER],
    ["avatars", "image/png", PNG_HEADER],
    ["avatars", "image/gif", GIF_HEADER],
    ["avatars", "image/webp", WEBP_HEADER],
    ["raw-submissions", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", DOCX_HEADER],
    ["raw-submissions", "application/msword", DOC_HEADER],
    ["podcast-audio", "audio/mpeg", MP3_ID3_HEADER],
    ["podcast-audio", "audio/mpeg", MP3_FRAME_SYNC_HEADER],
  ])("bucket %s accepts real %s bytes declared as that type", (bucket, contentType, bytes) => {
    const result = validateUploadBytes(bucket, contentType, bytes);
    expect(result.ok).toBe(true);
  });

  test("rejects a Windows executable renamed/declared as audio/mpeg", () => {
    const result = validateUploadBytes("podcast-audio", "audio/mpeg", EXE_HEADER);
    expect(result.ok).toBe(false);
  });

  test("rejects a Windows executable renamed/declared as application/pdf", () => {
    const result = validateUploadBytes("raw-submissions", "application/pdf", EXE_HEADER);
    expect(result.ok).toBe(false);
  });

  test("rejects a JPEG's bytes declared as image/png (mismatched real content)", () => {
    const result = validateUploadBytes("avatars", "image/png", JPEG_HEADER);
    expect(result.ok).toBe(false);
  });

  test("rejects an executable declared as a docx", () => {
    const result = validateUploadBytes("raw-submissions", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", EXE_HEADER);
    expect(result.ok).toBe(false);
  });

  test("plain-text formats have no magic-byte sniffer and are allowed through on content-type + size alone", () => {
    const result = validateUploadBytes("raw-submissions", "text/plain", Buffer.from("just some manuscript text"));
    expect(result.ok).toBe(true);
  });
});
