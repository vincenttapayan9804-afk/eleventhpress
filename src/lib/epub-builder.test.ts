/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { buildEpub } from "@/lib/epub-builder";

describe("buildEpub", () => {
  test("produces a valid ZIP with mimetype first, one chapter per input, and escaped titles", () => {
    const zip = buildEpub({ id: "article-1", title: "A Study of <Topological> Signatures", subtitle: null, authors: ["Ada Lovelace", "Alan Turing"] }, [
      { title: "A Study of <Topological> Signatures", html: "<p>Body</p>" },
    ]);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50); // local file header
    const text = zip.toString("latin1");
    expect(text).toContain("application/epub+zip");
    expect(text).toContain("A Study of &lt;Topological&gt; Signatures");
    expect(text).toContain("Ada Lovelace");
    expect(text).toContain("Alan Turing");
    expect(text).toContain("OEBPS/chapter-1.xhtml");
    expect(text).toContain("OEBPS/content.opf");
    expect(text).toContain("OEBPS/nav.xhtml");
    expect(text).toContain("META-INF/container.xml");
  });

  test("multi-chapter input produces one xhtml file per chapter", () => {
    const zip = buildEpub({ id: "article-2", title: "Title", subtitle: null, authors: [] }, [
      { title: "Section One", html: "<p>One</p>" },
      { title: "Section Two", html: "<p>Two</p>" },
    ]);
    const text = zip.toString("latin1");
    expect(text).toContain("OEBPS/chapter-1.xhtml");
    expect(text).toContain("OEBPS/chapter-2.xhtml");
  });
});

describe("epubAccessibilityMetadata", () => {
  test("claims WCAG conformance only when every image has alt text", async () => {
    const { epubAccessibilityMetadata } = await import("@/lib/epub-builder");
    const ok = epubAccessibilityMetadata([{ title: "c", html: '<p>x</p><img src="a.png" alt="A chart"/>' }], "Pub");
    expect(ok).toContain("schema:accessModeSufficient\">textual<");
    expect(ok).toContain("alternativeText");
    expect(ok).toContain("EPUB Accessibility 1.1 - WCAG 2.2 Level AA");

    const missing = epubAccessibilityMetadata([{ title: "c", html: '<img src="a.png" alt="">' }], "Pub");
    expect(missing).not.toContain("alternativeText");
    expect(missing).not.toContain("conformsTo");
    expect(missing).toContain("Some images do not yet have text alternatives");

    const text = epubAccessibilityMetadata([{ title: "c", html: "<p>only text</p>" }], "Pub");
    expect(text).not.toContain("accessMode\">visual");
    expect(text).toContain("accessibilityHazard\">none");
  });
});
