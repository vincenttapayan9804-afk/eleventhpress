import { describe, expect, test } from "bun:test";
import { decodeEntities } from "./html-entities";

describe("decodeEntities", () => {
  test("decodes named and numeric references", () => {
    expect(decodeEntities("Students&apos; Motivation &amp; Engagement")).toBe("Students' Motivation & Engagement");
    expect(decodeEntities("it&#39;s &#x2019;quoted&#8217;")).toBe("it's ’quoted’");
  });
  test("leaves unknown references and plain text alone", () => {
    expect(decodeEntities("A &unknown; B, 5 & 6")).toBe("A &unknown; B, 5 & 6");
  });
});
