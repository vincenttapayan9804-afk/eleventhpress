import { describe, expect, test } from "bun:test";
import { realDoi } from "./real-doi";

describe("realDoi", () => {
  test("accepts a registered or published real DOI", () => {
    expect(realDoi("10.1234/abc.1", "PUBLISHED")).toBe("10.1234/abc.1");
    expect(realDoi("10.1234/abc.1", "REGISTERED")).toBe("10.1234/abc.1");
  });
  test("rejects the 10.5072 test prefix, drafts, corrections and unregistered", () => {
    expect(realDoi("10.5072/epip.x", "PUBLISHED")).toBeNull();
    expect(realDoi("10.1234/epip.draft.1", "PUBLISHED")).toBeNull();
    expect(realDoi("10.1234/epip.correction.1", "PUBLISHED")).toBeNull();
    expect(realDoi("10.1234/abc", "DRAFT")).toBeNull();
    expect(realDoi("10.1234/abc", "NONE")).toBeNull();
    expect(realDoi(null, "PUBLISHED")).toBeNull();
    expect(realDoi("not a doi", "PUBLISHED")).toBeNull();
  });
});
