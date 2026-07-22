/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { buildOnixMessage, buildOnixProductsForBook, type OnixBookInput } from "@/lib/onix";

const FULL: OnixBookInput = {
  id: "book_full123",
  title: "Foundations of Multidisciplinary Research",
  subtitle: "A Practical Guide",
  authors: JSON.stringify([
    { name: "Ada Lovelace", affiliation: "Analytical Engine Institute", orcid: "0000-0002-1825-0097" },
    { name: "Alan Turing", affiliation: "Bletchley Park" },
  ]),
  description: "A comprehensive guide to multidisciplinary research methods & practice.",
  category: "Computer Science",
  isbn: "978-1-23456-789-7",
  price: 29.99,
  publishedAt: "2025-03-01T00:00:00.000Z",
  epubKey: "books/full123/book.epub",
  pdfKey: "books/full123/book.pdf",
  canonicalUrl: "https://eleventhpress.vercel.app/book/book_full123",
};

const MINIMAL: OnixBookInput = {
  id: "book_min456",
  title: "A Short Monograph",
  subtitle: null,
  authors: JSON.stringify([{ name: "Solo Author" }]),
  description: "A short work.",
  category: "Education",
  isbn: null,
  price: 0,
  publishedAt: "2025-01-15T00:00:00.000Z",
  epubKey: "books/min456/book.epub",
  pdfKey: null,
  canonicalUrl: "https://eleventhpress.vercel.app/book/book_min456",
};

const UNPRODUCED: OnixBookInput = {
  id: "book_none789",
  title: "Not Yet Produced",
  subtitle: null,
  authors: JSON.stringify([{ name: "Someone" }]),
  description: "Nothing to list yet.",
  category: "Physics",
  isbn: null,
  price: null,
  publishedAt: null,
  epubKey: null,
  pdfKey: null,
  canonicalUrl: "https://eleventhpress.vercel.app/book/book_none789",
};

describe("buildOnixProductsForBook", () => {
  test("emits one Product per available format (EPUB + print)", () => {
    const products = buildOnixProductsForBook(FULL);
    expect(products.length).toBe(2);
    expect(products.map((p) => p.kind).sort()).toEqual(["epub", "print"]);
    expect(products[0].recordReference).toBe("epip-book-book_full123-epub");
    expect(products[1].recordReference).toBe("epip-book-book_full123-print");
  });

  test("a book with neither EPUB nor print file produces no products", () => {
    expect(buildOnixProductsForBook(UNPRODUCED)).toEqual([]);
  });

  test("EPUB product uses ProductForm ED + ProductFormDetail E101; print uses BC", () => {
    const [epub, print] = buildOnixProductsForBook(FULL);
    expect(epub.xml).toContain("<ProductForm>ED</ProductForm>");
    expect(epub.xml).toContain("<ProductFormDetail>E101</ProductFormDetail>");
    expect(print.xml).toContain("<ProductForm>BC</ProductForm>");
    expect(print.xml).not.toContain("ProductFormDetail");
  });

  test("ISBN is emitted unhyphenated under ProductIDType 15, alongside the always-present proprietary ID", () => {
    const [epub] = buildOnixProductsForBook(FULL);
    expect(epub.xml).toContain("<ProductIDType>15</ProductIDType>");
    expect(epub.xml).toContain("<IDValue>9781234567897</IDValue>");
    expect(epub.xml).toContain("<ProductIDType>01</ProductIDType>");
    expect(epub.xml).toContain("<IDValue>book_full123</IDValue>");
  });

  test("a book with no ISBN omits the ISBN ProductIdentifier entirely", () => {
    const [epub] = buildOnixProductsForBook(MINIMAL);
    expect(epub.xml).not.toContain("<ProductIDType>15</ProductIDType>");
  });

  test("ORCID is recorded unhyphenated under NameIDType 21; an author without one gets no NameIdentifier", () => {
    const [epub] = buildOnixProductsForBook(FULL);
    expect(epub.xml).toContain("<NameIDType>21</NameIDType>");
    expect(epub.xml).toContain("<IDValue>0000000218250097</IDValue>");
    // Alan Turing has no ORCID — his Contributor block must not claim one.
    const turingBlock = epub.xml.split("Alan Turing")[0].split("<Contributor>").pop()!;
    expect(turingBlock).not.toContain("NameIdentifier");
  });

  test("title, subtitle, description, and category are carried through and escaped", () => {
    const [epub] = buildOnixProductsForBook(FULL);
    expect(epub.xml).toContain("<TitleText>Foundations of Multidisciplinary Research</TitleText>");
    expect(epub.xml).toContain("<Subtitle>A Practical Guide</Subtitle>");
    expect(epub.xml).toContain("&amp; practice");
    expect(epub.xml).toContain("<SubjectHeadingText>Computer Science</SubjectHeadingText>");
  });

  test("a subtitle-less book omits the Subtitle element", () => {
    const [epub] = buildOnixProductsForBook(MINIMAL);
    expect(epub.xml).not.toContain("Subtitle");
  });

  test("price above zero is emitted; a zero/null price omits the Price element", () => {
    const [epub] = buildOnixProductsForBook(FULL);
    expect(epub.xml).toContain("<PriceAmount>29.99</PriceAmount>");
    expect(epub.xml).toContain("<CurrencyCode>USD</CurrencyCode>");
    const [minEpub] = buildOnixProductsForBook(MINIMAL);
    expect(minEpub.xml).not.toContain("Price>");
  });

  test("PublishingDate reflects publishedAt as YYYYMMDD", () => {
    const [epub] = buildOnixProductsForBook(FULL);
    expect(epub.xml).toContain("<Date>20250301</Date>");
  });
});

describe("buildOnixMessage", () => {
  test("wraps every product from every book in one ONIXMessage with a Header", () => {
    const xml = buildOnixMessage([FULL, MINIMAL, UNPRODUCED]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<ONIXMessage release="3.0" xmlns="http://ns.editeur.org/onix/3.0/reference">');
    expect(xml).toContain("<SenderName>Eleventh Press International Publishing</SenderName>");
    expect((xml.match(/<Product>/g) || []).length).toBe(3); // 2 from FULL + 1 from MINIMAL, 0 from UNPRODUCED
    expect(xml).toContain("epip-book-book_full123-epub");
    expect(xml).toContain("epip-book-book_full123-print");
    expect(xml).toContain("epip-book-book_min456-epub");
    expect(xml).not.toContain("book_none789");
  });

  test("an empty book list still produces a well-formed, if product-less, message", () => {
    const xml = buildOnixMessage([]);
    expect(xml).toContain("<Header>");
    expect(xml).not.toContain("<Product>");
  });
});
