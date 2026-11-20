import { describe, expect, test } from "bun:test";
import { canonicalSection, galleyToPassages, sectionOfPath, sectionsForQuestion } from "./section-chunker";

describe("canonicalSection", () => {
  test("maps numbered and plain headings to the parts of a paper", () => {
    expect(canonicalSection("2.1. Sampling Procedure")).toBe("methods");
    expect(canonicalSection("III. RESULTS AND DISCUSSION")).toBe("results");
    expect(canonicalSection("Chapter 1 Introduction")).toBe("introduction");
    expect(canonicalSection("Review of Related Literature")).toBe("introduction");
    expect(canonicalSection("Conclusions and Recommendations")).toBe("conclusion");
    expect(canonicalSection("Limitations of the Study")).toBe("limitations");
    expect(canonicalSection("References")).toBe("references");
    expect(canonicalSection("Acknowledgements")).toBe("other");
    expect(canonicalSection("Mangrove belts")).toBeNull();
  });

  test("the deepest heading that names a section wins", () => {
    expect(sectionOfPath(["Methods", "Study area"])).toBe("methods");
    expect(sectionOfPath(["Results", "Village outcomes"])).toBe("results");
    expect(sectionOfPath(["Mangrove belts"])).toBeNull();
  });
});

describe("sectionsForQuestion", () => {
  test("finds the parts of the paper a question is about", () => {
    expect(sectionsForQuestion("What were the limitations of the mangrove study?")).toEqual(["limitations", "discussion", "conclusion"]);
    expect(sectionsForQuestion("Who were the respondents?")).toEqual(["methods"]);
    expect(sectionsForQuestion("What did they find?")).toEqual(["results", "discussion"]);
    expect(sectionsForQuestion("Which sources do they cite?")).toEqual(["references"]);
  });

  test("a question about the topic itself names no section", () => {
    expect(sectionsForQuestion("How do mangroves reduce storm surge?")).toEqual([]);
  });
});

const GALLEY = `<!doctype html><html><head><title>T</title><style>p{}</style></head><body>
<section class="front"><h1>Mangrove Restoration</h1><p class="authors">Ana Rivera</p></section>
<div class="abstract"><p>Abstract text that is indexed separately.</p></div>
<div class="article-body">
  <h2>1. Introduction</h2>
  <p>Coastal villages face storm surges.</p>
  <h2>2. Methods</h2>
  <h3>2.1 Sampling</h3>
  <p>We sampled 42 villages &amp; their shorelines.</p>
  <h2>3. Results</h2>
  <p>Damage fell by 31.4%.</p>
  <table><caption>Table 2. Damage by district</caption>
    <thead><tr><th>District</th><th>Damage (%)</th></tr></thead>
    <tbody><tr><td>Khulna</td><td>12 | 3</td></tr><tr><td>Satkhira</td><td>18</td></tr></tbody>
  </table>
  <figure><img src="f.png" alt="Map of sites"><figcaption>Figure 1. Study sites</figcaption></figure>
  <h2>References</h2>
  <ol><li>Smith, J. (2020). Mangroves. Journal of Coasts.</li></ol>
</div>
<footer>Site footer text</footer>
</body></html>`;

describe("galleyToPassages", () => {
  const passages = galleyToPassages(GALLEY);

  test("reads only the article body, with each passage under its headings", () => {
    const all = passages.map((p) => p.text).join(" ");
    expect(all).not.toContain("Abstract text");
    expect(all).not.toContain("Site footer");
    expect(all).not.toContain("Mangrove Restoration");
    const sampling = passages.find((p) => p.text.includes("42 villages"))!;
    expect(sampling).toMatchObject({ headingPath: ["Methods", "Sampling"], section: "methods", kind: "text" });
    expect(sampling.text).toContain("42 villages & their shorelines");
    expect(passages.find((p) => p.text.includes("storm surges"))).toMatchObject({ headingPath: ["Introduction"], section: "introduction" });
  });

  test("a table becomes one Markdown passage with its caption, escaping cell pipes", () => {
    const table = passages.find((p) => p.kind === "table")!;
    expect(table.section).toBe("results");
    expect(table.text).toBe(
      "Table: Table 2. Damage by district\n| District | Damage (%) |\n| --- | --- |\n| Khulna | 12 \\| 3 |\n| Satkhira | 18 |"
    );
  });

  test("a figure becomes a passage of its caption and alt text", () => {
    expect(passages.find((p) => p.kind === "figure")).toMatchObject({
      text: "Figure: Figure 1. Study sites (Map of sites)",
      headingPath: ["Results"],
      section: "results",
    });
  });

  test("the reference list is marked as such", () => {
    const refs = passages.find((p) => p.text.includes("Smith, J."))!;
    expect(refs).toMatchObject({ kind: "references", section: "references" });
  });

  test("a long section is split into overlapping passages at sentence ends", () => {
    const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} explains one more detail of the method.`).join(" ");
    const out = galleyToPassages(`<div class="article-body"><h2>Methods</h2><p>${long}</p></div>`);
    expect(out.length).toBeGreaterThan(2);
    for (const p of out) {
      expect(p.text.length).toBeLessThanOrEqual(800);
      expect(p.section).toBe("methods");
    }
    expect(out[0].text.endsWith(".")).toBe(true);
  });

  test("a long table is split into row groups that each repeat the header", () => {
    const rows = Array.from({ length: 80 }, (_, i) => `<tr><td>Row ${i} with a fairly long label</td><td>${i}</td></tr>`).join("");
    const out = galleyToPassages(`<div class="article-body"><table><tr><th>Item</th><th>Value</th></tr>${rows}</table></div>`);
    expect(out.length).toBeGreaterThan(1);
    for (const p of out) {
      expect(p.kind).toBe("table");
      expect(p.text.startsWith("| Item | Value |\n| --- | --- |")).toBe(true);
      expect(p.text.length).toBeLessThanOrEqual(1700);
    }
  });

  test("a page without an article-body skips the front matter and title", () => {
    const out = galleyToPassages(`<h1>Title</h1><div class="authors">A. Author</div><h2>Discussion</h2><p>We discuss.</p>`);
    expect(out).toEqual([{ text: "We discuss.", headingPath: ["Discussion"], section: "discussion", kind: "text" }]);
  });

  test("equations are kept as $$TeX$$, from the TeX annotation, alttext or MathML text", () => {
    const html =
      '<div class="article-body"><h2>Methods</h2><p>The score is <math><semantics><mrow><mi>x</mi><mo>=</mo><mn>2</mn></mrow>' +
      '<annotation encoding="application/x-tex">x = \\frac{a}{b}</annotation></semantics></math> per item.</p>' +
      '<math display="block" alttext="y=mx+c"><mi>y</mi></math><p>Then <math><mi>n</mi><mo>&gt;</mo><mn>30</mn></math>.</p></div>';
    const [p] = galleyToPassages(html);
    expect(p.text).toContain("The score is $$x = \\frac{a}{b}$$ per item.");
    expect(p.text).toContain("\n$$y=mx+c$$\n");
    expect(p.text).toContain("Then $$n>30$$");
    expect(p.text).not.toContain("x=2");
  });

  test("a long section is never split inside an equation", () => {
    const eq = "$$" + "a + b ".repeat(30) + "$$";
    const text = Array.from({ length: 12 }, (_, i) => `Sentence ${i} is here and talks a little. ${eq}`).join(" ");
    const out = galleyToPassages(`<div class="article-body"><p>${text}</p></div>`);
    expect(out.length).toBeGreaterThan(1);
    for (const x of out) expect((x.text.match(/\$\$/g) ?? []).length % 2).toBe(0);
  });
});
