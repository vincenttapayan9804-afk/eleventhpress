import { describe, test, expect } from "bun:test";
import {
  shortTitle,
  sectionQuestions,
  remainingSectionQuestions,
  sectionRetrievalHints,
  finalizeSuggestions,
  starterQuestions,
  SECTION_NAMES,
  MAX_SUGGESTIONS,
} from "./suggested-questions";

const TITLE = "NAVIGATING THE EDUCATIONAL LANDSCAPE: EXPERIENCES OF DESIGNATED GUIDANCE COUNSELORS IN LOCAL COLLEGES  ";

describe("shortTitle", () => {
  test("uses the part before a subtitle colon and fixes ALL-CAPS titles", () => {
    expect(shortTitle(TITLE)).toBe("Navigating the Educational Landscape");
  });

  test("keeps the full title when the pre-colon part is too short, and truncates long titles", () => {
    expect(shortTitle("COVID-19: A Review")).toBe("COVID-19: A Review");
    expect(shortTitle("One Two Three Four Five Six Seven Eight Nine Ten")).toBe("One Two Three Four Five Six Seven Eight…");
  });
});

describe("section questions", () => {
  test("cover every major part of a research paper, in reading order", () => {
    expect(SECTION_NAMES).toEqual([
      "Problem",
      "Background",
      "Research gap",
      "Research questions",
      "Hypotheses",
      "Theoretical framework",
      "Research design",
      "Respondents",
      "Instruments",
      "Data analysis",
      "Results",
      "Discussion",
      "Conclusions",
      "Limitations",
      "Recommendations",
      "Significance",
      "Authors",
    ]);
    const qs = sectionQuestions(TITLE);
    expect(qs).toHaveLength(SECTION_NAMES.length);
    for (const q of qs) {
      expect(q.question).toContain("“Navigating the Educational Landscape”");
      expect(q.question.endsWith("?")).toBe(true);
    }
    expect(qs.find((q) => q.section === "Respondents")!.question).toMatch(/respondents or participants/);
    expect(qs.find((q) => q.section === "Research questions")!.question).toMatch(/statement of the problem/);
  });

  test("a clicked section chip removes only that section", () => {
    const discussion = sectionQuestions(TITLE).find((q) => q.section === "Discussion")!.question;
    const left = remainingSectionQuestions(TITLE, [discussion]).map((q) => q.section);
    expect(left).not.toContain("Discussion");
    // The Discussion question mentions "results", but Results stays available.
    expect(left).toContain("Results");
    expect(left).toHaveLength(SECTION_NAMES.length - 1);
  });

  test("a typed question removes the sections it asks about", () => {
    const left = remainingSectionQuestions(TITLE, ["Who were the respondents and what questionnaire was used?"]).map(
      (q) => q.section
    );
    expect(left).not.toContain("Respondents");
    expect(left).not.toContain("Instruments");
    expect(left).toContain("Hypotheses");
    // "designated" in a title-like question doesn't count as asking about the design.
    expect(remainingSectionQuestions(TITLE, ["Tell me about designated counselors"]).map((q) => q.section)).toContain(
      "Research design"
    );
  });

  test("section questions add the words papers use in that part to retrieval", () => {
    expect(sectionRetrievalHints("Who were the respondents in the study?")).toMatch(/participants.*purposive/);
    expect(sectionRetrievalHints("What hypotheses were tested?")).toMatch(/null/);
    expect(sectionRetrievalHints("Tell me about mangroves")).toBe("");
  });
});

describe("finalizeSuggestions", () => {
  test("keeps clean, specific model follow-ups and drops junk, duplicates and repeats", () => {
    const chips = sectionQuestions(TITLE);
    const out = finalizeSuggestions(
      [
        "How did counselors describe their workload under dual teaching roles?",
        "how did counselors describe their workload under dual teaching roles",
        "1. What training gaps did the designated counselors report?",
        42,
        "Why?",
        "x".repeat(300),
        chips[0].question,
        "What did the study ask?",
      ],
      ["What did the study ask?"],
      chips
    );
    expect(out).toEqual([
      "How did counselors describe their workload under dual teaching roles?",
      "What training gaps did the designated counselors report?",
    ]);
  });

  test("never returns more than the maximum, and nothing for a non-array", () => {
    const many = Array.from({ length: 10 }, (_, i) => `What is aspect number ${i} of the study?`);
    expect(finalizeSuggestions(many, [])).toHaveLength(MAX_SUGGESTIONS);
    expect(finalizeSuggestions(undefined, [])).toEqual([]);
  });
});

describe("starterQuestions", () => {
  test("one question per recent article, each about a different part of the paper", () => {
    expect(starterQuestions(["Paper Alpha On Things", "Paper Beta On Stuff", TITLE])).toEqual([
      "What problem does “Paper Alpha On Things” address?",
      "What are the main results and findings of “Paper Beta On Stuff”?",
      "What research design and methods does “Navigating the Educational Landscape” use?",
    ]);
  });
});
