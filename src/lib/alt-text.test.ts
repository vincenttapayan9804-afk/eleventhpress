/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { extractImgTags, applyAltText } from "@/lib/alt-text";

describe("extractImgTags", () => {
  test("extracts src and alt from a simple tag", () => {
    const html = `<p>Intro</p><img src="published-galleys/fig1.png" alt="Original caption"><p>More text</p>`;
    expect(extractImgTags(html)).toEqual([{ src: "published-galleys/fig1.png", existingAlt: "Original caption" }]);
  });

  test("handles multiple images, self-closing tags, and missing alt", () => {
    const html = `<img src="a.png" /><figure><img src="b.png" alt=""></figure><img src="c.png" alt="Has caption">`;
    expect(extractImgTags(html)).toEqual([
      { src: "a.png", existingAlt: "" },
      { src: "b.png", existingAlt: "" },
      { src: "c.png", existingAlt: "Has caption" },
    ]);
  });

  test("ignores img tags with no src", () => {
    const html = `<img alt="orphan, no src"><img src="real.png" alt="real">`;
    expect(extractImgTags(html)).toEqual([{ src: "real.png", existingAlt: "real" }]);
  });

  test("returns an empty array when there are no images", () => {
    expect(extractImgTags("<p>No figures here.</p>")).toEqual([]);
  });

  test("handles single-quoted attributes and extra attributes in any order", () => {
    const html = `<img class='fig' alt='Quoted alt' src='d.png' width="400">`;
    expect(extractImgTags(html)).toEqual([{ src: "d.png", existingAlt: "Quoted alt" }]);
  });
});

describe("applyAltText", () => {
  test("rewrites alt on the matching tag and leaves everything else untouched", () => {
    const html = `<p>Intro</p><img src="a.png" alt="old"><img src="b.png" alt="unchanged">`;
    const result = applyAltText(html, [{ src: "a.png", altText: "New description" }]);
    expect(result).toContain('<img src="a.png" alt="New description">');
    expect(result).toContain('<img src="b.png" alt="unchanged">');
  });

  test("adds an alt attribute to a tag that previously had none", () => {
    const html = `<img src="a.png">`;
    const result = applyAltText(html, [{ src: "a.png", altText: "Now described" }]);
    expect(result).toContain('<img src="a.png" alt="Now described">');
  });

  test("escapes double quotes and ampersands in the new alt text", () => {
    const html = `<img src="a.png" alt="old">`;
    const result = applyAltText(html, [{ src: "a.png", altText: 'A "quoted" term & more' }]);
    expect(result).toContain('alt="A &quot;quoted&quot; term &amp; more"');
  });

  test("a src with no matching update is left untouched", () => {
    const html = `<img src="a.png" alt="untouched">`;
    expect(applyAltText(html, [{ src: "does-not-exist.png", altText: "x" }])).toBe(html);
  });
});
