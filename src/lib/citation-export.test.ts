/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { buildBibTeX, buildRis, buildWikidataQuickStatements, coinsSpanProps, type ExportableArticle } from "@/lib/citation-export";

const FULL: ExportableArticle = {
  title: "On the Distribution of Prime Gaps",
  authors: JSON.stringify([
    { name: "Ada Lovelace", affiliation: "Analytical Engine Institute", email: "ada@example.org" },
    { name: "Alan Turing", affiliation: "Bletchley Park", email: "alan@example.org" },
  ]),
  publishedAt: "2025-03-01T00:00:00.000Z",
  doi: "10.5281/zenodo.123456",
  journalName: "Eleventh Press Journal of Mathematics",
  journalIssn: "2945-1138",
  volume: 4,
  issueNumber: 2,
};

const MINIMAL: ExportableArticle = {
  title: "A Forthcoming Study",
  authors: JSON.stringify([{ name: "Solo Author", affiliation: "Nowhere U.", email: "solo@example.org" }]),
  publishedAt: null,
  doi: null,
  journalName: null,
  journalIssn: null,
  volume: null,
  issueNumber: null,
  year: null,
};

describe("buildBibTeX", () => {
  test("multi-author, full metadata", () => {
    const out = buildBibTeX(FULL);
    expect(out).toContain("author  = {Ada Lovelace and Alan Turing}");
    expect(out).toContain("title   = {On the Distribution of Prime Gaps}");
    expect(out).toContain("journal = {Eleventh Press Journal of Mathematics}");
    expect(out).toContain("year    = {2025}");
    expect(out).toContain("volume  = {4}");
    expect(out).toContain("number  = {2}");
    expect(out).toContain("issn    = {2945-1138}");
    expect(out).toContain("doi     = {10.5281/zenodo.123456}");
    expect(out.startsWith("@article{105281zenodo123456,")).toBe(true);
  });

  test("missing DOI falls back to the 'epip' key and empty doi field", () => {
    const out = buildBibTeX(MINIMAL);
    expect(out.startsWith("@article{epip,")).toBe(true);
    expect(out).toContain("doi     = {}");
    expect(out).toContain("volume  = {}");
    expect(out).toContain("year    = {forthcoming}");
  });
});

describe("buildRis", () => {
  test("one AU line per author, in order", () => {
    const out = buildRis(FULL);
    expect(out).toContain("AU  - Ada Lovelace\nAU  - Alan Turing");
    expect(out).toContain("SN  - 2945-1138");
    expect(out).toContain("DO  - 10.5281/zenodo.123456");
    expect(out.startsWith("TY  - JOUR")).toBe(true);
    expect(out.trim().endsWith("ER  -")).toBe(true);
  });

  test("missing volume/issue/doi render as empty fields, not 'undefined'", () => {
    const out = buildRis(MINIMAL);
    expect(out).toContain("VL  - \n");
    expect(out).toContain("IS  - \n");
    expect(out).toContain("DO  - \n");
    expect(out).not.toContain("undefined");
  });
});

describe("buildWikidataQuickStatements", () => {
  test("emits a CREATE batch with title, instance-of, date, DOI, and one P2093 line per author", () => {
    const out = buildWikidataQuickStatements(FULL);
    const lines = out.split("\n");
    expect(lines[0]).toBe("CREATE");
    expect(out).toContain('LAST|Len|"On the Distribution of Prime Gaps"');
    expect(out).toContain("LAST|P31|Q13442814");
    expect(out).toContain('LAST|P1476|en:"On the Distribution of Prime Gaps"');
    expect(out).toContain("LAST|P577|+2025-03-01T00:00:00Z/11");
    expect(out).toContain('LAST|P356|"10.5281/zenodo.123456"');
    expect(out).toContain('LAST|P953|"https://doi.org/10.5281/zenodo.123456"');
    expect(out).toContain('LAST|P2093|"Ada Lovelace"');
    expect(out).toContain('LAST|P2093|"Alan Turing"');
  });

  test("omits P577/P356/P953 when publishedAt/doi are absent, never emits 'undefined'", () => {
    const out = buildWikidataQuickStatements(MINIMAL);
    expect(out).not.toContain("P577");
    expect(out).not.toContain("P356");
    expect(out).not.toContain("P953");
    expect(out).not.toContain("undefined");
    expect(out).toContain('LAST|P2093|"Solo Author"');
  });

  test("escapes embedded double quotes in the title", () => {
    const out = buildWikidataQuickStatements({ ...MINIMAL, title: 'A "Quoted" Title' });
    expect(out).toContain('LAST|Len|"A \\"Quoted\\" Title"');
  });
});

describe("coinsSpanProps", () => {
  test("encodes one rft.au per author and the DOI as an info:doi/ URI", () => {
    const { className, title } = coinsSpanProps(FULL);
    expect(className).toBe("Z3988");
    const params = new URLSearchParams(title);
    expect(params.getAll("rft.au")).toEqual(["Ada Lovelace", "Alan Turing"]);
    expect(params.get("rft_id")).toBe("info:doi/10.5281/zenodo.123456");
    expect(params.get("rft.atitle")).toBe(FULL.title);
    expect(params.get("ctx_ver")).toBe("Z39.88-2004");
  });

  test("omits volume/issue/issn/rft_id params entirely when absent, rather than encoding empty strings", () => {
    const { title } = coinsSpanProps(MINIMAL);
    const params = new URLSearchParams(title);
    expect(params.has("rft.volume")).toBe(false);
    expect(params.has("rft.issue")).toBe(false);
    expect(params.has("rft.issn")).toBe(false);
    expect(params.has("rft_id")).toBe(false);
  });
});
