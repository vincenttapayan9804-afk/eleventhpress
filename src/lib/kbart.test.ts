/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { KBART_COLUMNS, bookRow, buildKbart, journalRow, kbartFilename } from "@/lib/kbart";

describe("KBART", () => {
  test("header has the 25 Phase II columns and rows match its width", () => {
    const out = buildKbart([
      journalRow({
        id: "j1",
        name: "Journal\tof Tests",
        issn: "1234-5678",
        eissn: "8765-4321",
        publisher: "Pub",
        titleUrl: "https://x.test/articles",
        issues: [
          { volume: 2, issueNumber: 1, year: 2026, publishedAt: new Date("2026-03-01") },
          { volume: 1, issueNumber: 2, year: 2025, publishedAt: new Date("2025-09-01") },
          { volume: 1, issueNumber: 1, year: 2025, publishedAt: new Date("2025-06-15") },
        ],
      }),
      bookRow({ id: "b1", title: "A Book", isbn: "9780000000000", firstAuthor: "Ada Lovelace", publishedAt: new Date("2026-01-02"), titleUrl: "https://x.test/book/b1", publisher: "Pub", free: true }),
    ]);
    const lines = out.trimEnd().split("\n");
    expect(lines[0].split("\t")).toEqual([...KBART_COLUMNS]);
    expect(KBART_COLUMNS.length).toBe(25);
    for (const l of lines) expect(l.split("\t").length).toBe(25);
    const j = lines[1].split("\t");
    expect(j[0]).toBe("Journal of Tests");
    expect(j[3]).toBe("2025-06-15");
    expect(j[4]).toBe("1");
    expect(j[5]).toBe("1");
    expect(j[16]).toBe("serial");
    expect(j[24]).toBe("F");
    const b = lines[2].split("\t");
    expect(b[10]).toBe("Lovelace");
    expect(b[16]).toBe("monograph");
    expect(b[18]).toBe("2026-01-02");
  });

  test("file name follows the KBART convention", () => {
    expect(kbartFilename("Eleventh Press", new Date("2026-11-19T00:00:00Z"))).toBe("EleventhPress_Global_AllTitles_2026-11-19.txt");
  });
});
