import { afterAll, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";

type LlmModule = typeof import("@/lib/llm");
// Query-string specifier bypasses any mock another file registered.
const REAL = { llm: "../llm.ts?real=study-guide-test" };
const realLlm = (await import(REAL.llm)) as LlmModule;

let active = false;
let reply: unknown = null;
mock.module("@/lib/llm", () => ({
  ...realLlm,
  anyLLMAvailable: () => (active ? true : realLlm.anyLLMAvailable()),
  chatJSON: (async (...args: Parameters<LlmModule["chatJSON"]>) => {
    if (!active) return realLlm.chatJSON(...args);
    const data = typeof reply === "function" ? (reply as (sys: string, user: string) => unknown)(args[0], args[1]) : reply;
    return { data, rawResponse: "", model: "test-model", provider: "oss-free" };
  }) as LlmModule["chatJSON"],
}));
afterAll(() => {
  active = false;
});

const { buildOutline } = await import("./outline");
const { buildExtractiveGuide, generateStudyGuide } = await import("./build");
const { renderStudyGuideHtml, studyGuideFileName } = await import("./render");
const { STUDY_GUIDE_TEMPLATE } = await import("./template.generated");
const { extractiveContent, RESEARCH_VISUALS_VERSION } = await import("@/lib/research-visuals");

const BODY = `
<p><strong>JUAN DELA CRUZ</strong></p>
<p><strong>TABLE OF CONTENTS</strong></p>
<p><strong>INTRODUCTION</strong></p>
<p><strong>CHAPTER I</strong></p>
<p><strong>INTRODUCTION</strong></p>
<p><strong>Background of the Study</strong></p>
<p>Teacher self-efficacy shapes how learners engage in class, yet few studies in Davao del Norte examine it (Bandura, 1997). This gap matters because engagement predicts achievement in public secondary schools.</p>
<p>The Department of Education (DepEd) reported that 68.4% of teachers completed digital training in 2023, but classroom use remains uneven across schools and subjects.</p>
<p><strong>Statement of the Problem</strong></p>
<p>This study aims to determine the influence of teacher self-efficacy on learner engagement. Specifically, it seeks to answer the following questions:</p>
<li>What is the level of teacher self-efficacy?</li>
<li>Is there a significant relationship between teacher self-efficacy and learner engagement?</li>
<p><strong>Definition of Terms</strong></p>
<p><strong>Teacher Self-Efficacy.</strong> This refers to the teacher's belief in their capacity to plan and deliver lessons that engage learners, as measured by the adapted questionnaire.</p>
<p><strong>CHAPTER II</strong></p>
<p><strong>METHODOLOGY</strong></p>
<p><strong>Research Respondents</strong></p>
<p>The respondents were 312 teachers from public secondary schools selected through stratified random sampling, with a margin of error of 0.05 and a confidence level of 95%.</p>
<p><strong>Statistical Tools</strong></p>
<p>Mean and standard deviation describe the levels of the variables, while Pearson r tests the relationship between teacher self-efficacy and learner engagement (Pallant, 2020).</p>
<p><strong>REFERENCES</strong></p>
<p>Bandura, A. (1997). Self-efficacy: The exercise of control. W. H. Freeman.</p>
<p>Pallant, J. (2020). SPSS survival manual (7th ed.). Routledge.</p>
<p>Unused, K. (2019). A source never cited in the text. Journal of Examples, 1(1), 1–2.</p>
`.repeat(1);

const TITLE = "Teacher Self-Efficacy and Learner Engagement in Public Secondary Schools";
const ABSTRACT = "This study examines teacher self-efficacy and learner engagement among 312 teachers.";

function source() {
  const content = {
    version: RESEARCH_VISUALS_VERSION,
    mode: "extractive" as const,
    model: "extractive",
    generatedAt: "2026-11-15T00:00:00.000Z",
    ...extractiveContent({ id: "a1", title: TITLE, abstract: ABSTRACT, keywords: "self-efficacy; engagement", discipline: "Education", bodyHtml: BODY }, BODY.replace(/<[^>]+>/g, " ")),
  };
  return {
    id: "a1",
    title: TITLE,
    abstract: ABSTRACT,
    keywords: "self-efficacy; engagement",
    discipline: "Education",
    authors: [{ name: "JUAN DELA CRUZ", affiliation: "Sample University" }],
    bodyHtml: BODY,
    references: [],
    content,
  };
}

const META = {
  articleId: "a1",
  title: TITLE,
  shortTitle: "Teacher Self-Efficacy and Learner Engagement",
  authors: ["Juan Dela Cruz"],
  affiliations: ["Sample University"],
  journalName: "Sample Journal",
  publisher: "Sample Press",
  publishedAt: new Date("2026-11-01T00:00:00Z"),
  doi: "10.5555/x.1",
  articleUrl: "https://example.org/article/a1",
  contentType: "RESEARCH",
  logoDataUri: null,
  whitelabel: false,
  poweredBy: null,
};

describe("template", () => {
  test("the bundled template matches template.html (run scripts/gen-study-guide-template.mjs)", () => {
    expect(STUDY_GUIDE_TEMPLATE).toBe(readFileSync(new URL("./template.html", import.meta.url), "utf-8"));
  });
});

describe("buildOutline", () => {
  test("reads chapters, sections, paragraphs and references, skipping the title page and contents", () => {
    const o = buildOutline(BODY, ABSTRACT);
    expect(o.fullText).toBe(true);
    expect(o.chapters).toEqual({ 1: "Chapter 1 · Introduction", 2: "Chapter 2 · Methodology" });
    expect(o.sections.map((s) => s.heading)).toEqual(["Background of the Study", "Statement of the Problem", "Definition of Terms", "Research Respondents", "Statistical Tools"]);
    expect(o.sections.map((s) => s.ch)).toEqual([1, 1, 1, 2, 2]);
    // List items stay with the paragraph that introduces them.
    expect(o.sections[1].paras).toHaveLength(1);
    expect(o.sections[1].paras[0].text).toContain("What is the level of teacher self-efficacy?");
    expect(o.references).toHaveLength(3);
  });

  test("falls back to the abstract when there is no full text", () => {
    const o = buildOutline(null, "Purpose: To test. Methods: A survey of 40 nurses. Results: Most agreed.");
    expect(o.fullText).toBe(false);
    expect(o.sections[0].paras.map((p) => p.label)).toEqual(["Purpose", "Methods", "Results"]);
  });
});

describe("buildExtractiveGuide", () => {
  const g = buildExtractiveGuide(source());

  test("every paragraph keeps the manuscript text verbatim with an explanation", () => {
    const paras = g.sections.flatMap((s) => s.paras);
    expect(paras.length).toBeGreaterThan(5);
    for (const p of paras) {
      expect(p.orig.length).toBeGreaterThan(0);
      expect(p.gist.length).toBeGreaterThan(0);
      expect(p.role.length).toBeGreaterThan(0);
      expect(p.label.length).toBeGreaterThan(0);
    }
    expect(paras.some((p) => p.orig.includes("312 teachers from public secondary schools"))).toBe(true);
  });

  test("numbers, glossary, references and slides come from the article", () => {
    expect(g.numbers.map((n) => n.v)).toEqual(expect.arrayContaining(["312 teachers", "68.4%"]));
    expect(g.glossary.map((x) => x.term)).toEqual(expect.arrayContaining(["Teacher Self-Efficacy", "DepEd"]));
    const bandura = g.refs.find((r) => r.key.startsWith("Bandura"));
    expect(bandura?.where).toEqual(["1.1 Background of the Study"]);
    expect(g.refs.find((r) => r.key.startsWith("Unused"))?.where).toEqual([]);
    expect(g.slides[0].note).toContain("Juan Dela Cruz");
    // Each slide number named on a section exists in the script.
    const nums = new Set(g.slides.map((s) => `Slide ${s.n}`));
    for (const s of g.sections) if (s.slides.startsWith("Slide ")) expect(nums.has(s.slides)).toBe(true);
    expect(g.chapters[3]).toBe("Figures, Tables & References");
  });
});

describe("renderStudyGuideHtml", () => {
  test("fills every placeholder and embeds the data safely", () => {
    const g = buildExtractiveGuide(source());
    g.sections[0].paras[0].orig += " </script><script>alert(1)</script> {{TITLE}}";
    const html = renderStudyGuideHtml(g, META);
    expect(html.replace(/const DATA = .*;\n/, "")).not.toMatch(/\{\{[A-Z0-9]+\}\}/);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    const data = JSON.parse(html.match(/const DATA = (.*);\n/)![1]);
    expect(data.sections[0].paras[0].orig).toContain("</script><script>alert(1)</script> {{TITLE}}");
    expect(data.big.modelSvg).toStartWith("<svg");
    expect(html).toContain(`<h1>${TITLE}</h1>`);
    expect(html).toContain("localStorage.getItem('study-guide-a1:'+k)");
    // Platform documents carry the EP medallion and no platform credit.
    expect(html).toContain(">EP</text>");
    expect(html).not.toContain("Powered by");
  });

  test("tenant guides carry the tenant's logo and the fixed platform credit", () => {
    const html = renderStudyGuideHtml(buildExtractiveGuide(source()), {
      ...META,
      whitelabel: true,
      logoDataUri: "data:image/png;base64,AAAA",
      poweredBy: "Powered by Eleventh Press International Publishing™",
    });
    expect(html).toContain('src="data:image/png;base64,AAAA"');
    expect(html).not.toContain(">EP</text>");
    expect(html).toContain("Powered by Eleventh Press International Publishing™");
  });

  test("file name uses the first author's surname", () => {
    expect(studyGuideFileName({ authors: ["Darra Marie C. Nazon"], shortTitle: "X" })).toBe("Nazon_Study_Guide.html");
  });
});

describe("generateStudyGuide with an LLM", () => {
  test("uses grounded explanations and drops any invented number", async () => {
    active = true;
    reply = (system: string, user: string) => {
      if (system.includes("For each manuscript section")) {
        const ids = [...user.matchAll(/### id: (\S+)/g)].map((m) => m[1]);
        return {
          sections: ids.map((id) => ({
            id,
            overview: id.startsWith("research-respondents") ? "Explains who answered the survey: 312 teachers." : "Explains the section.",
            slideNote: "Here I explain this part.",
            paras: [{ i: 0, label: "Who took part", gist: id.startsWith("research-respondents") ? "A total of 999 teachers took part." : "A grounded paraphrase.", role: "Shows the sample." }],
            qa: [{ q: "Who took part?", a: id.startsWith("research-respondents") ? "312 teachers, chosen by stratified random sampling." : "As the section explains." }],
          })),
        };
      }
      return { elevator: ["One sentence about teachers.", "Another sentence about engagement.", "A third sentence about the method."], numbers: [], glossary: [] };
    };
    try {
      const g = await generateStudyGuide(source());
      expect(g.mode).toBe("llm");
      const resp = g.sections.find((s) => s.id.startsWith("research-respondents"))!;
      expect(resp.overview).toBe("Explains who answered the survey: 312 teachers.");
      expect(resp.qa[0].a).toContain("312 teachers");
      // "999" is not in the article, so the extractive gist is kept.
      expect(resp.paras[0].gist).not.toContain("999");
      expect(resp.paras[0].gist).toContain("312");
      expect(g.elevator).toHaveLength(3);
    } finally {
      active = false;
    }
  });
});
