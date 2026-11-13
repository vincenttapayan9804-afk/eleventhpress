import { describe, expect, test } from "bun:test";
import {
  bodyHtmlToText,
  extractFigures,
  extractKeyNumbers,
  extractTheories,
  extractiveContent,
  sanitizeExtraction,
} from "./research-visuals";
import { buildResearchVisualPdf, RESEARCH_VISUAL_KINDS } from "./research-visuals-pdf";

const SOURCE = `Teacher self-efficacy and digital competence. This study examines how teacher self-efficacy and digital competence relate to learner engagement.
Anchored on Social Cognitive Theory, a survey of n = 312 teachers found that 68.4% were highly competent; digital competence correlated with engagement (r = .62).`;

describe("sanitizeExtraction", () => {
  test("drops numbers, theories and constructs the article never states", () => {
    const out = sanitizeExtraction(
      {
        findings: ["Digital competence related to engagement."],
        keyNumbers: [
          { value: "68.4%", label: "Highly competent" },
          { value: "91.2%", label: "Invented figure" },
        ],
        framework: {
          layout: "variables",
          theories: [{ name: "Social Cognitive Theory", note: "" }, { name: "Expectancy Value Theory", note: "" }],
          constructs: [
            { id: "c1", label: "Digital competence", role: "independent", items: [] },
            { id: "c2", label: "Learner engagement", role: "dependent", items: [] },
            { id: "c3", label: "Parental income bracket", role: "moderator", items: [] },
          ],
          relationships: [{ from: "c1", to: "c2", label: "H1" }, { from: "c3", to: "c2", label: "H2" }],
        },
      },
      SOURCE,
      "Title"
    );
    expect(out.keyNumbers.map((k) => k.value)).toEqual(["68.4%"]);
    expect(out.framework.theories.map((t) => t.name)).toEqual(["Social Cognitive Theory"]);
    expect(out.framework.constructs.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(out.framework.relationships).toEqual([{ from: "c1", to: "c2", label: "H1" }]);
    expect(out.framework.layout).toBe("variables");
  });

  test("falls back to a theory or no framework when constructs are missing", () => {
    expect(sanitizeExtraction({ framework: { layout: "variables", theories: [{ name: "Social Cognitive Theory" }] } }, SOURCE, "T").framework.layout).toBe("theory");
    expect(sanitizeExtraction({ framework: { layout: "ipo" } }, SOURCE, "T").framework.layout).toBe("none");
  });
});

describe("extractive fallback", () => {
  test("reads structured abstract headings and real numbers", () => {
    const c = extractiveContent(
      {
        id: "a",
        title: "T",
        keywords: "",
        discipline: "",
        abstract:
          "Purpose: This study examines digital competence. Methods: A survey of 312 teachers was analysed using regression. Results: Competence correlated with engagement (r = .62) and 68.4% were highly competent. Conclusion: Training should be prioritised.",
      },
      ""
    );
    expect(c.objective).toContain("digital competence");
    expect(c.methods.design).toContain("312 teachers");
    expect(c.conclusion).toContain("Training");
    expect(c.keyNumbers.map((k) => k.value)).toContain("68.4%");
    expect(c.framework.layout).toBe("none");
  });

  test("finds named theories", () => {
    expect(extractTheories("Guided by Social Cognitive Theory and the Technology Acceptance Model, we ...").map((t) => t.name)).toEqual([
      "Social Cognitive Theory",
      "Technology Acceptance Model",
    ]);
  });

  test("key numbers skip years", () => {
    expect(extractKeyNumbers("In 2024, 45% of schools reported gains.").map((k) => k.value)).toEqual(["45%"]);
  });
});

describe("figures", () => {
  test("captions and framework detection", () => {
    const figs = extractFigures(
      '<p>Figure 1. Conceptual framework of the study</p><p><img src="https://x.test/a.png" alt=""></p><figure><img src="https://x.test/b.png"><figcaption>Figure 2. Mean scores by grade</figcaption></figure><img src="data:image/png;base64,AAA">'
    );
    expect(figs).toHaveLength(2);
    expect(figs[0]).toMatchObject({ number: "1", isFramework: true });
    expect(figs[1]).toMatchObject({ number: "2", isFramework: false });
  });

  test("body text keeps headings", () => {
    expect(bodyHtmlToText("<h2>Methods</h2><p>We surveyed &amp; interviewed.</p>")).toContain("## Methods\nWe surveyed & interviewed.");
  });
});

describe("PDF renderers", () => {
  const content = {
    version: 1, mode: "extractive" as const, model: "x", generatedAt: "",
    shortTitle: "Short", background: "Context.", objective: "Aim.", researchQuestions: [],
    methods: { design: "Survey", participants: "", setting: "", instruments: "", analysis: "" },
    keyNumbers: [{ value: "45%", label: "Schools" }], findings: ["A finding."], conclusion: "Done.", implications: [], limitations: [],
    framework: { layout: "none" as const, title: "Theoretical Framework", theories: [], constructs: [], relationships: [], narrative: "" },
  };
  const article = { id: "a", title: "A title", authors: "[]", articleUrl: "https://example.org/article/a" };
  for (const kind of RESEARCH_VISUAL_KINDS) {
    test(`${kind} renders for platform and tenant, with the credit only on tenant documents`, async () => {
      const platform = await buildResearchVisualPdf(kind, { article, content, brand: { whitelabel: false, orgName: "Eleventh Press International Publishing", journalName: "EPIP" } });
      const tenant = await buildResearchVisualPdf(kind, { article, content, brand: { whitelabel: true, orgName: "Ron Publishing", journalName: "Ron Journal", primaryHex: "#0f766e", accentHex: "#f59e0b" } });
      expect(platform.subarray(0, 5).toString()).toBe("%PDF-");
      expect(tenant.subarray(0, 5).toString()).toBe("%PDF-");
    });
  }
});
