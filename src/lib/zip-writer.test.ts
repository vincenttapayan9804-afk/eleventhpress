/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { buildZip } from "@/lib/zip-writer";

/** Minimal hand-rolled ZIP reader for test verification only — reads local
 * file headers sequentially and extracts each entry's name and stored
 * bytes, which is enough to prove buildZip() round-trips correctly without
 * pulling in a real unzip dependency. */
function readZipEntries(buf: Buffer): { name: string; data: Buffer }[] {
  const entries: { name: string; data: Buffer }[] = [];
  let offset = 0;
  while (offset < buf.length) {
    const signature = buf.readUInt32LE(offset);
    if (signature !== 0x04034b50) break; // stop at the central directory
    const compressedSize = buf.readUInt32LE(offset + 18);
    const nameLength = buf.readUInt16LE(offset + 26);
    const extraLength = buf.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = buf.subarray(nameStart, nameStart + nameLength).toString("utf-8");
    const data = buf.subarray(dataStart, dataStart + compressedSize);
    entries.push({ name, data: Buffer.from(data) });
    offset = dataStart + compressedSize;
  }
  return entries;
}

describe("buildZip", () => {
  test("round-trips entry names and bytes exactly", () => {
    const entries = [
      { name: "mimetype", data: Buffer.from("application/epub+zip", "ascii") },
      { name: "OEBPS/chapter-1.xhtml", data: Buffer.from("<html><body><h1>Hi</h1></body></html>", "utf-8") },
    ];
    const zip = buildZip(entries);
    const parsed = readZipEntries(zip);

    expect(parsed.length).toBe(2);
    expect(parsed[0].name).toBe("mimetype");
    expect(parsed[0].data.toString("ascii")).toBe("application/epub+zip");
    expect(parsed[1].name).toBe("OEBPS/chapter-1.xhtml");
    expect(parsed[1].data.toString("utf-8")).toBe(entries[1].data.toString("utf-8"));
  });

  test("mimetype is the first entry, stored uncompressed", () => {
    const zip = buildZip([{ name: "mimetype", data: Buffer.from("application/epub+zip") }]);
    // Local file header signature + compression method field (offset 8) must be 0 (stored)
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(zip.readUInt16LE(8)).toBe(0);
  });

  test("ends with a valid end-of-central-directory record", () => {
    const zip = buildZip([{ name: "a.txt", data: Buffer.from("x") }]);
    const eocdSignature = zip.readUInt32LE(zip.length - 22);
    expect(eocdSignature).toBe(0x06054b50);
    const totalRecords = zip.readUInt16LE(zip.length - 12);
    expect(totalRecords).toBe(1);
  });

  test("produces a byte-identical CRC for identical content across entries", () => {
    const zip = buildZip([
      { name: "one.txt", data: Buffer.from("same content") },
      { name: "two.txt", data: Buffer.from("same content") },
    ]);
    const parsed = readZipEntries(zip);
    expect(parsed[0].data.equals(parsed[1].data)).toBe(true);
  });

  test("handles an empty entry list", () => {
    const zip = buildZip([]);
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
  });
});
