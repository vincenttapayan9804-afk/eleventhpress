/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { attentionMetricsConfigured, altmetricBadgeProps, plumxBadgeProps } from "@/lib/attention-metrics";

describe("attentionMetricsConfigured", () => {
  test("false when there's no DOI", () => {
    expect(attentionMetricsConfigured({ doi: null, doiStatus: "PUBLISHED" })).toBe(false);
  });

  test("false when the DOI exists but the article isn't published yet", () => {
    expect(attentionMetricsConfigured({ doi: "10.5281/zenodo.123", doiStatus: "DRAFT" })).toBe(false);
  });

  test("true once a DOI is minted and the article is published", () => {
    expect(attentionMetricsConfigured({ doi: "10.5281/zenodo.123", doiStatus: "PUBLISHED" })).toBe(true);
  });
});

describe("badge prop builders", () => {
  test("altmetricBadgeProps keys off the given DOI", () => {
    const props = altmetricBadgeProps("10.5281/zenodo.123");
    expect(props["data-doi"]).toBe("10.5281/zenodo.123");
    expect(props.className).toBe("altmetric-embed");
  });

  test("plumxBadgeProps keys off the given DOI", () => {
    const props = plumxBadgeProps("10.5281/zenodo.123");
    expect(props["data-doi"]).toBe("10.5281/zenodo.123");
    expect(props.className).toBe("plumx-plum-print-popup");
  });
});
