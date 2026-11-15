/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { buildBibTeX, buildRis, buildMarcXml, buildWikidataQuickStatements, coinsSpanProps, splitPersonName, type ExportableArticle } from "@/lib/citation-export";

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
  test("multi-author, full metadata, names inverted, conventional cite key", () => {
    const out = buildBibTeX(FULL);
    expect(out.startsWith("@article{lovelace2025distribution,")).toBe(true);
    expect(out).toMatch(/author\s+= \{Lovelace, Ada and Turing, Alan\}/);
    expect(out).toMatch(/title\s+= \{On the Distribution of Prime Gaps\}/);
    expect(out).toMatch(/journal\s+= \{Eleventh Press Journal of Mathematics\}/);
    expect(out).toMatch(/year\s+= \{2025\}/);
    expect(out).toMatch(/month\s+= mar,/);
    expect(out).toMatch(/volume\s+= \{4\}/);
    expect(out).toMatch(/number\s+= \{2\}/);
    expect(out).toMatch(/issn\s+= \{2945-1138\}/);
    expect(out).toMatch(/doi\s+= \{10.5281\/zenodo.123456\}/);
    expect(out).toMatch(/url\s+= \{https:\/\/doi.org\/10.5281\/zenodo.123456\}/);
    expect(out.trim().endsWith("}")).toBe(true);
  });

  test("missing fields are left out, not written empty", () => {
    const out = buildBibTeX(MINIMAL);
    expect(out.startsWith("@article{author")).toBe(true);
    expect(out).not.toMatch(/doi\s+=/);
    expect(out).not.toMatch(/volume\s+=/);
    expect(out).not.toContain("{}");
    expect(out).toMatch(/year\s+= \{forthcoming\}/);
  });

  test("LaTeX special characters are escaped and acronyms protected", () => {
    const out = buildBibTeX({ ...FULL, title: "Costs & Benefits of 50% FTIR_Scans in R&D", keywords: "pH, #tags" });
    expect(out).toContain("Costs \\& Benefits of 50\\% {FTIR\\_Scans} in {R\\&D}");
    expect(out).toContain("\\#tags");
    expect(out).not.toMatch(/[^\\][&%#]/);
  });

  test("abstract and keywords are included, HTML stripped", () => {
    const out = buildBibTeX({ ...FULL, abstract: "<p>We <em>found</em> gaps.</p>", keywords: "primes, gaps" });
    expect(out).toMatch(/abstract\s+= \{We found gaps.\}/);
    expect(out).toMatch(/keywords\s+= \{primes, gaps\}/);
  });
});

describe("buildRis", () => {
  test("one AU line per author (Family, Given), CRLF line ends, ER last", () => {
    const out = buildRis(FULL);
    expect(out).toContain("AU  - Lovelace, Ada\r\nAU  - Turing, Alan");
    expect(out).toContain("SN  - 2945-1138");
    expect(out).toContain("DO  - 10.5281/zenodo.123456");
    expect(out).toContain("DA  - 2025/03/01/");
    expect(out).toContain("UR  - https://doi.org/10.5281/zenodo.123456");
    expect(out.startsWith("TY  - JOUR\r\n")).toBe(true);
    expect(out.trim().endsWith("ER  -")).toBe(true);
    expect(out.replace(/\r\n/g, "")).not.toContain("\n");
  });

  test("missing volume/issue/doi are left out, never 'undefined'", () => {
    const out = buildRis(MINIMAL);
    expect(out).not.toContain("VL  -");
    expect(out).not.toContain("IS  -");
    expect(out).not.toContain("DO  -");
    expect(out).not.toContain("undefined");
  });

  test("keywords become one KW line each and the abstract is one line", () => {
    const out = buildRis({ ...FULL, abstract: "Line one.\nLine two.", keywords: "primes; gaps, number theory" });
    expect(out).toContain("KW  - primes\r\nKW  - gaps\r\nKW  - number theory");
    expect(out).toContain("AB  - Line one. Line two.");
  });
});

describe("buildMarcXml", () => {
  test("well-formed record: 008 is 40 positions, names inverted, journal as host item", () => {
    const out = buildMarcXml({ ...FULL, id: "a1", publisher: "Eleventh Press", articleUrl: "https://x.org/article/a1", keywords: "primes, gaps" });
    const f008 = /<controlfield tag="008">([^<]*)<\/controlfield>/.exec(out)![1];
    expect(f008.length).toBe(40);
    expect(f008.slice(7, 11)).toBe("2025");
    expect(f008.slice(35, 38)).toBe("eng");
    expect(out).toContain('<subfield code="a">Lovelace, Ada,</subfield>');
    expect(out).toContain('<datafield tag="700" ind1="1" ind2=" ">');
    expect(out).toContain('<datafield tag="773" ind1="0" ind2=" ">');
    expect(out).toContain('<subfield code="g">Vol. 4, no. 2 (2025)</subfield>');
    expect(out).toContain('<subfield code="a">On the Distribution of Prime Gaps.</subfield>');
  });

  test("leading article sets the non-filing indicator", () => {
    const out = buildMarcXml({ ...FULL, title: "The Primes" });
    expect(out).toContain('<datafield tag="245" ind1="1" ind2="4">');
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
    expect(out).toContain('LAST|P356|"10.5281/ZENODO.123456"');
    expect(out).toContain('LAST|P953|"https://doi.org/10.5281/zenodo.123456"');
    expect(out).toContain('LAST|P478|"4"');
    expect(out).toContain('LAST|P433|"2"');
    expect(out).toContain("LAST|P275|Q20007257");
    expect(out).toContain('LAST|P2093|"Ada Lovelace"|P1545|"1"');
    expect(out).toContain('LAST|P2093|"Alan Turing"|P1545|"2"');
  });

  test("omits P577/P356/P953 when publishedAt/doi are absent, never emits 'undefined'", () => {
    const out = buildWikidataQuickStatements(MINIMAL);
    expect(out).not.toContain("P577");
    expect(out).not.toContain("P356");
    expect(out).not.toContain("P953");
    expect(out).not.toContain("undefined");
    expect(out).toContain('LAST|P2093|"Solo Author"|P1545|"1"');
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

describe("splitPersonName", () => {
  test("family name, particles, inverted input, suffixes", () => {
    expect(splitPersonName("Mei Lin Tan")).toEqual({ family: "Tan", given: "Mei Lin" });
    expect(splitPersonName("Ludwig van Beethoven")).toEqual({ family: "van Beethoven", given: "Ludwig" });
    expect(splitPersonName("Tan, Mei Lin")).toEqual({ family: "Tan", given: "Mei Lin" });
    expect(splitPersonName("Dr. Jose Rizal Jr.")).toEqual({ family: "Rizal, Jr.", given: "Jose" });
    expect(splitPersonName("Plato")).toEqual({ family: "Plato", given: "" });
  });
});
