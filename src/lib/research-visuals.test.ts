import { describe, expect, test } from "bun:test";
import {
  bodyHtmlToText,
  displayCase,
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
    version: 2, mode: "extractive" as const, model: "x", generatedAt: "", stage: "results" as const, hypotheses: [], significance: "",
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
    test(`${kind} renders a proposal (no findings) with hypotheses`, async () => {
      const proposal = { ...content, stage: "proposal" as const, findings: [], conclusion: "", hypotheses: ["There is no significant relationship between X and Y."], significance: "It informs school leaders." };
      const pdf = await buildResearchVisualPdf(kind, { article, content: proposal, brand: { whitelabel: false, orgName: "Eleventh Press International Publishing", journalName: "EPIP" } });
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    });
  }
});

describe("real manuscript structure (thesis outline, bold headings)", () => {
  const body = [
    "<p><strong>TABLE OF CONTENTS</strong></p><p><strong>1. INTRODUCTION</strong></p><p><strong>REFERENCES</strong></p>",
    "<p><strong>BACKGROUND OF THE STUDY</strong></p><p>Teachers face growing demands in blended classrooms across the province. Support systems remain uneven between schools.</p>",
    "<p><strong>STATEMENT OF THE PROBLEM</strong></p><p>This research seeks to investigate whether classroom learning environment and institutional support significantly influence students’ motivated strategies among secondary institutions in the Province of Davao Del Norte.</p>",
    "<p>Specifically, this research seeks to answer the following questions:</p>",
    "<p>1. What is the level of classroom learning environment among secondary institutions in the Province of Davao Del Norte in terms of:</p><p>1. 1 Classroom Positive;</p><p>1.2 Diversity Values; and</p><p>1.3 Persistence in major?</p>",
    "<p>2. What is the level of students’ motivated strategies among secondary institutions in the Province of Davao Del Norte in terms of:</p><p>2.1 Self-Efficacy; and</p><p>2.2 Self-Regulation?</p>",
    "<p>3. Is there a significant relationship between:</p><p>3.1 classroom learning environment and students’ motivated strategies;</p><p>3.2 institutional support and students’ motivated strategies?</p>",
    "<p><strong>HYPOTHESES</strong></p><p>The following hypotheses will be tested at a 0.05 level of significance:</p><p>1. There is no significant relationship between classroom learning environment and students’ motivated strategies.</p><p>2 There is no significant relationship between institutional support and students’ motivated strategies.</p>",
    "<p><strong>REVIEW OF RELATED LITERATURE</strong></p><p>Many studies discuss Learning Theory in classrooms (Smith, 2020).</p>",
    "<p><strong>THEORETICAL AND CONCEPTUAL FRAMEWORK</strong></p><p>This study is anchored on the Self-Determination Theory (SDT), which posits that autonomy matters (Deci &amp; Ryan, 1985). The Constructivist Learning Theory also applies.</p><p><strong>INSTITUTIONAL SUPPORT</strong></p><p><strong>CLASSROOM LEARNING ENVIRONMENT</strong></p><p><strong>STUDENTS’ MOTIVATED STRATEGIES FOR LEARNING TLE</strong></p>",
    "<p><strong>RESEARCH DESIGN</strong></p><p>This proposed quantitative study will utilize the descriptive and correlational approach. Data will be analysed after collection.</p>",
    "<p><strong>RESEARCH RESPONDENTS</strong></p><p>The respondents will be students from schools in the province of Davao del Norte, school year 2024-2025. With a total population of 2785, the sample size is determined to be 338 students. Its population per the 2020 Census was 1,125,057.</p>",
    "<p><strong>DATA GATHERING PROCEDURE</strong></p><p><strong>Mean.</strong> The mean will be used.</p><p><strong>Pearson-r.</strong> Pearson-r will be used.</p><p><strong>Multiple Regression Analysis.</strong> It will be used.</p>",
    "<p><strong>REFERENCES</strong></p><p>Deci, E. (1985). Intrinsic motivation.</p>",
  ].join("");
  const src = { id: "x", title: "CLASSROOM LEARNING ENVIRONMENT AND INSTITUTIONAL SUPPORT AS PREDICTORS OF STUDENTS’ MOTIVATED STRATEGIES (TLE)", abstract: "This research seeks to investigate whether classroom learning environment and institutional support significantly influence students’ motivated strategies.", keywords: "", discipline: "", bodyHtml: body };
  const c = extractiveContent(src, bodyHtmlToText(body));

  test("an outline manuscript is a proposal: no findings, no conclusion", () => {
    expect(c.stage).toBe("proposal");
    expect(c.findings).toEqual([]);
    expect(c.conclusion).toBe("");
  });
  test("research questions are parsed as numbered (tolerating '1. 1'), without the repeated locative", () => {
    expect(c.researchQuestions[0]).toBe("What is the level of classroom learning environment?");
    expect(c.researchQuestions).toContain("Is there a significant relationship between institutional support and students’ motivated strategies?");
  });
  test("hypotheses come from the hypotheses section only", () => {
    expect(c.hypotheses).toHaveLength(2);
    expect(c.hypotheses[1]).toMatch(/^There is no significant relationship between institutional support/);
  });
  test("methods are drawn from the methodology sections", () => {
    expect(c.methods.design).toBe("Quantitative and descriptive-correlational design");
    expect(c.methods.participants).toBe("338 students from a population of 2,785");
    expect(c.methods.setting).toBe("Province of Davao del Norte, SY 2024-2025");
    expect(c.methods.analysis).toBe("Mean, Pearson r and multiple regression analysis");
    expect(c.keyNumbers.map((k) => k.value)).toEqual(["338", "2,785", "0.05"]);
  });
  test("variables framework with the article's indicators and hypothesis labels", () => {
    expect(c.framework.layout).toBe("variables");
    const [iv1, iv2, dv] = c.framework.constructs;
    expect(iv1.label).toBe("Classroom Learning Environment");
    expect(iv1.items).toEqual(["Classroom Positive", "Diversity Values", "Persistence in major"]);
    expect(iv2.role).toBe("independent");
    expect(dv.role).toBe("dependent");
    expect(dv.items).toEqual(["Self-Efficacy", "Self-Regulation"]);
    expect(c.framework.relationships.map((r) => r.label)).toEqual(["H1", "H2"]);
  });
  test("theories come from the framework section, with their citation", () => {
    expect(c.framework.theories.map((t) => t.name)).toEqual(["Self-Determination Theory (SDT)", "Constructivist Learning Theory"]);
    expect(c.framework.theories[0].note).toBe("Deci & Ryan, 1985");
  });
  test("all-caps titles are printed in title case", () => {
    expect(c.shortTitle).toBe("Classroom Learning Environment and Institutional Support as Predictors of Students’ Motivated Strategies (TLE)");
    expect(displayCase("LYN V. HINAMPAS")).toBe("Lyn V. Hinampas");
    expect(displayCase("Already Mixed Case")).toBe("Already Mixed Case");
  });
});

describe("abstract-only articles", () => {
  test("a research question is never a finding", () => {
    const c = extractiveContent({ id: "q", title: "T", abstract: "This research seeks to investigate whether X significantly influences Y. 1. What is the level of X? 2. Is there a significant relationship between X and Y?", keywords: "", discipline: "" }, "");
    expect(c.findings).toEqual([]);
  });
  test("ranges are one number and counts keep their unit", () => {
    const c = extractiveContent({ id: "m", title: "T", abstract: "We sampled influent at 48 biofilter cells across six cities. Median retention efficiency ranged from 61% to 89%, with fibres retained less. We provide design heuristics.", keywords: "", discipline: "" }, "");
    expect(c.stage).toBe("results");
    expect(c.keyNumbers).toContainEqual({ value: "61–89%", label: "Median retention efficiency" });
    expect(c.keyNumbers).toContainEqual({ value: "48", label: "Biofilter cells" });
    expect(c.conclusion).toBe("We provide design heuristics.");
  });
});
