/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { buildBookPackage, getBookPlatform, BOOK_PLATFORMS } from "@/lib/book-distribution";

const BOOK = {
  id: "book-1",
  title: "Collected Essays on Number Theory",
  subtitle: "A Compilation",
  authors: JSON.stringify([{ name: "Ada Lovelace" }, { name: "Alan Turing" }]),
  description: "A compiled volume of essays.",
  category: "Mathematics",
  isbn: "978-0-000000-0-0",
  price: 24.99,
};

describe("BOOK_PLATFORMS / getBookPlatform", () => {
  test("Tier C platforms (Amazon KDP, Lulu) have no consent requirement or submit URL", () => {
    for (const p of BOOK_PLATFORMS.filter((p) => p.tier === "C")) {
      expect(p.consentText).toBeUndefined();
      expect(p.submitUrl).toBeUndefined();
    }
  });

  test("Tier B platforms (Draft2Digital, IngramSpark) require consent and have a submit URL", () => {
    const tierB = BOOK_PLATFORMS.filter((p) => p.tier === "B");
    expect(tierB.map((p) => p.id).sort()).toEqual(["DRAFT2DIGITAL", "INGRAMSPARK"]);
    for (const p of tierB) {
      expect(p.consentText).toBeTruthy();
      expect(p.submitUrl).toBeTruthy();
      expect(p.coverage).toBeTruthy();
    }
  });

  test("getBookPlatform resolves a known id and returns undefined for an unknown one", () => {
    expect(getBookPlatform("AMAZON_KDP")?.label).toBe("Amazon KDP");
    expect(getBookPlatform("DRAFT2DIGITAL")?.tier).toBe("B");
    expect(getBookPlatform("NOT_A_PLATFORM")).toBeUndefined();
  });

  test("covers all 7 book-distributor platforms from the plan via Draft2Digital/IngramSpark aggregation", () => {
    expect(BOOK_PLATFORMS.length).toBe(4);
    const coverageText = BOOK_PLATFORMS.map((p) => p.coverage || "").join(" ");
    expect(coverageText).toContain("Apple Books");
    expect(coverageText).toContain("Barnes & Noble");
    expect(coverageText).toContain("Kobo");
    expect(coverageText).toContain("Smashwords");
  });
});

describe("buildBookPackage", () => {
  test("includes title, subtitle, joined author names, description, category, isbn, and price", () => {
    const pkg = buildBookPackage(BOOK);
    expect(pkg.title).toBe(BOOK.title);
    expect(pkg.subtitle).toBe(BOOK.subtitle);
    expect(pkg.authors).toBe("Ada Lovelace; Alan Turing");
    expect(pkg.description).toBe(BOOK.description);
    expect(pkg.category).toBe(BOOK.category);
    expect(pkg.isbn).toBe(BOOK.isbn);
    expect(pkg.price).toBe(BOOK.price);
  });

  test("derives a canonical URL from the book id", () => {
    const pkg = buildBookPackage(BOOK);
    expect(pkg.canonicalUrl.endsWith(`/book/${BOOK.id}`)).toBe(true);
  });

  test("falls back to null subtitle and 0 price when absent", () => {
    const pkg = buildBookPackage({ ...BOOK, subtitle: null, price: null });
    expect(pkg.subtitle).toBeNull();
    expect(pkg.price).toBe(0);
  });

  test("falls back to null isbn when absent", () => {
    const pkg = buildBookPackage({ ...BOOK, isbn: null });
    expect(pkg.isbn).toBeNull();
  });

  test("falls back to 'the authors' when the authors JSON has no usable names", () => {
    const pkg = buildBookPackage({ ...BOOK, authors: "[]" });
    expect(pkg.authors).toBe("the authors");
  });

  test("falls back to 'the authors' when the authors JSON is malformed", () => {
    const pkg = buildBookPackage({ ...BOOK, authors: "not json" });
    expect(pkg.authors).toBe("the authors");
  });

  test("keywords default to the book's category", () => {
    const pkg = buildBookPackage(BOOK);
    expect(pkg.keywords).toBe(BOOK.category);
  });
});
