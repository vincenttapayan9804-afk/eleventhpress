import { describe, test, expect } from "bun:test";
import { buildResearchDocx, buildResearchPdf, consolidatedReferences, markdownBlocks, reportFileName, reportMarkdown, type ResearchReport } from "./research-export";

const REPORT: ResearchReport = {
  title: "How do restored mangroves affect storm-surge damage?",
  scope: "response",
  journal: { name: "Journal of Tests", issn: "1234-5678", publisher: "Test Press" },
  generatedAt: new Date("2026-11-06T10:00:00Z"),
  siteUrl: "https://journal.example",
  items: [
    {
      question: "How do restored mangroves affect storm-surge damage?",
      answer:
        "Restored belts cut damage by **31.4%** [1].\n\n### Articles compared\n| Article | Design |\n|---|---|\n| *Mangroves* | Matched comparison [1] |\n\n### Limitations\n- Self-reported damage [2]\n1. Varied restoration age",
      citations: [
        { n: 1, sourceId: "a1", kind: "passage", text: "Restoration reduced storm-surge damage by 31.4%." },
        { n: 2, sourceId: "a1", kind: "record", text: "We assess mangrove restoration." },
      ],
      sources: [{ id: "a1", title: "Mangroves and Storm Surge", url: "https://journal.example/article/a1", reference: "Rivera, A. (2025). Mangroves and Storm Surge. Journal of Tests. https://doi.org/10.5555/ep.1" }],
      evidenceStatus: "verified",
      warnings: [],
    },
  ],
};

describe("markdownBlocks", () => {
  test("parses headings, emphasis, tables and lists", () => {
    const blocks = markdownBlocks(REPORT.items[0].answer);
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "heading", "table", "heading", "list", "list"]);
    const p = blocks[0] as Extract<(typeof blocks)[number], { type: "paragraph" }>;
    expect(p.inlines.find((i) => i.bold)?.text).toBe("31.4%");
    const t = blocks[2] as Extract<(typeof blocks)[number], { type: "table" }>;
    expect(t.header).toEqual(["Article", "Design"]);
    expect(t.rows).toEqual([["Mangroves", "Matched comparison [1]"]]);
  });
});

describe("research reports", () => {
  test("Markdown edition has the question, answer, evidence, references and the AI note", () => {
    const md = reportMarkdown(REPORT);
    expect(md).toContain("# How do restored mangroves affect storm-surge damage?");
    expect(md).toContain("Journal of Tests · ISSN 1234-5678");
    expect(md).toContain("[1] Mangroves and Storm Surge.");
    expect(md).toContain("## References");
    expect(md).toContain("Rivera, A. (2025).");
    expect(md).toMatch(/AI Research Assistant/);
  });

  test("references are de-duplicated across a conversation", () => {
    const conv: ResearchReport = { ...REPORT, scope: "conversation", items: [REPORT.items[0], REPORT.items[0]] };
    expect(consolidatedReferences(conv)).toHaveLength(1);
  });

  test("PDF and DOCX are generated", async () => {
    const pdf = await buildResearchPdf(REPORT);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    // One page for a short answer: the running footer must not spill onto new pages.
    expect((pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length).toBe(1);
    const docx = await buildResearchDocx(REPORT);
    expect(docx.subarray(0, 2).toString()).toBe("PK");
  });

  test("file names are readable and dated", () => {
    expect(reportFileName(REPORT, "pdf")).toBe("research-assistant-how-do-restored-mangroves-affect-storm-surge-damage-2026-11-06.pdf");
  });
});
