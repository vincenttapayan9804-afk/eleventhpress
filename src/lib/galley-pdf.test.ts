/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import PDFDocument from "pdfkit";
import { htmlToBlocks, printable, renderBody, registerGalleyFonts, BUILTIN_FONTS, decodeEntities } from "@/lib/galley-pdf";
import { buildJatsBodyAndBack, linesToParagraphs } from "@/lib/galley";
import { toXhtml } from "@/lib/epub-builder";

const MANUSCRIPT = `
<h1>Introduction</h1>
<p>Microplastics &amp; wastewater (Tan, 2024). Removal was 90.5% with H<sub>2</sub>O<sub>2</sub> and r<sup>2</sup> = 0.81.</p>
<h2>Research Questions</h2>
<ol><li>What is the mean?</li><li>How does it vary?<ul><li>By season</li></ul></li></ol>
<table><thead><tr><th>Plant</th><th>Removal (%)</th></tr></thead><tbody><tr><td>A</td><td>93.4</td></tr><tr><td>B</td><td>89.2</td></tr></tbody></table>
<blockquote><p>A quoted passage.</p></blockquote>
<p>References</p>
<p>Smith, J. (2023). <em>A study</em>. Journal, 1(2), 3–4.</p>
<p>Lee, H. (2022). Another study. Journal, 5, 6–7.</p>
`;

describe("htmlToBlocks", () => {
  const blocks = htmlToBlocks(MANUSCRIPT);

  test("keeps headings, lists (with nesting), tables and quotes", () => {
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "para", "heading", "list", "table", "quote", "para", "para", "para"]);
    const list = blocks[3] as Extract<(typeof blocks)[number], { kind: "list" }>;
    expect(list.items.map((i) => [i.depth, i.marker])).toEqual([[0, "1."], [0, "2."], [1, "◦"]]);
    const table = blocks[4] as Extract<(typeof blocks)[number], { kind: "table" }>;
    expect(table.rows[0].header).toBe(true);
    expect(table.rows.length).toBe(3);
  });

  test("inline sub/superscripts and entities survive", () => {
    const para = blocks[1] as Extract<(typeof blocks)[number], { kind: "para" }>;
    expect(para.runs.some((r) => r.sub && r.text === "2")).toBe(true);
    expect(para.runs.some((r) => r.sup && r.text === "2")).toBe(true);
    expect(para.runs.map((r) => r.text).join("")).toContain("Microplastics & wastewater");
  });

  test("a Word figure's caption paragraph becomes the image caption, once", () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    const b = htmlToBlocks(`<p><img src="${png}" alt="Figure 1. Plants"></p><p>Figure 1. Plants</p><p>Body.</p>`);
    expect(b.map((x) => x.kind)).toEqual(["image", "para"]);
    expect((b[0] as any).caption.map((r: any) => r.text).join("")).toBe("Figure 1. Plants");
  });

  test("drops <head>/<style>/<header> content from a full page", () => {
    const b = htmlToBlocks("<html><head><title>T</title><style>p{}</style></head><body><header>Masthead</header><p>Only this.</p></body></html>");
    expect(b).toHaveLength(1);
    expect((b[0] as any).runs[0].text).toBe("Only this.");
  });
});

describe("printable", () => {
  test("bundled fonts keep Greek, maths and subscripts; fill the two glyphs they lack", () => {
    const fonts = { ...BUILTIN_FONTS, unicode: true };
    expect(printable("α ≤ β, H₂O, x⁰", fonts)).toBe("α ≤ β, H₂O, x0");
  });
  test("built-in fonts get readable stand-ins instead of broken glyphs", () => {
    expect(printable("α ≤ 0.05, H₂O, “quoted” — µm", BUILTIN_FONTS)).toBe("alpha <= 0.05, H2O, “quoted” — µm");
  });
  test("decodes numeric and named entities", () => {
    expect(decodeEntities("&#945; &#x3B2; &le; &nbsp;")).toBe("α β ≤  ");
  });
});

describe("renderBody", () => {
  test("typesets a full manuscript into a valid PDF with the bundled fonts", async () => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 64, bottom: 62, left: 60, right: 60 }, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((r) => doc.on("end", () => r(Buffer.concat(chunks))));
    const fonts = registerGalleyFonts(doc);
    expect(fonts.unicode).toBe(true);
    const n = renderBody(doc, MANUSCRIPT.repeat(6), { fonts, primary: "#4c1d95", accent: "#c9a55c", ink: "#1f1a2e", muted: "#5f5873" });
    expect(n).toBeGreaterThan(40);
    expect(doc.bufferedPageRange().count).toBeGreaterThan(1);
    doc.end();
    const pdf = await done;
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1")).toContain("LiberationSerif");
  });
});

describe("JATS body and back", () => {
  const { body, back } = buildJatsBodyAndBack(MANUSCRIPT);

  test("headings open nested <sec>s that are all closed", () => {
    expect(body).toContain('<sec id="s1"><title>Introduction</title>');
    expect(body.match(/<sec /g)!.length).toBe(body.match(/<\/sec>/g)!.length);
    expect(body).toContain("H<sub>2</sub>O<sub>2</sub>");
    expect(body).toContain('<list list-type="order">');
    expect(body).toContain("<thead><tr><th>Plant</th>");
    expect(body).toContain("&amp; wastewater");
  });

  test("paragraphs under References become the real reference list", () => {
    expect(back).toContain('<ref id="ref1"><mixed-citation>Smith, J. (2023). <italic>A study</italic>');
    expect(back).toContain('<ref id="ref2">');
    expect(body).not.toContain("Smith, J.");
  });
});

describe("linesToParagraphs (PDF manuscripts)", () => {
  test("rebuilds paragraphs and keeps section titles on their own", () => {
    const text = [
      "Introduction",
      "Microplastic contamination in urban wastewater has become a pressing concern for",
      "municipal utilities across Southeast Asia, and this study examines it over twelve",
      "months at three plants.",
      "Methods",
      "We sampled influent and effluent monthly at each of the three plants in the",
      "metropolitan area during the wet and dry sea-",
      "sons of the study year.",
    ].join("\n");
    expect(linesToParagraphs(text).split("\n\n")).toEqual([
      "Introduction",
      "Microplastic contamination in urban wastewater has become a pressing concern for municipal utilities across Southeast Asia, and this study examines it over twelve months at three plants.",
      "Methods",
      "We sampled influent and effluent monthly at each of the three plants in the metropolitan area during the wet and dry seasons of the study year.",
    ]);
  });
});

describe("toXhtml", () => {
  test("closes void elements and converts HTML-only entities", () => {
    expect(toXhtml('<p>a<br>b&nbsp;c &amp; <img src="x.png" alt="y"></p>')).toBe('<p>a<br/>b&#160;c &amp; <img src="x.png" alt="y"/></p>');
  });
});
