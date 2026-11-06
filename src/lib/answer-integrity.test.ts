import { describe, test, expect } from "bun:test";
import { apaReference, passageUrl, resolveCitations, stripModelReferenceList, verifyAnswer, type EvidenceArticle } from "./answer-integrity";

const BASE = "https://journal.example";
const ARTICLES: EvidenceArticle[] = [
  {
    id: "a1",
    label: "A1",
    title: "Mangroves and Storm Surge",
    authors: JSON.stringify([{ name: "Ana María Rivera", affiliation: "University of Dhaka" }, { name: "Ben Ito" }]),
    abstract: "We assess mangrove restoration as storm-surge protection.",
    keywords: "mangroves; storm surge",
    doi: "10.5555/ep.1",
    publishedAt: new Date("2025-02-01T00:00:00Z"),
    discipline: "Environmental Science",
  },
  {
    id: "a2",
    label: "A2",
    title: "Sepsis Detection in Rural Clinics",
    authors: JSON.stringify([{ name: "Chen Wei" }]),
    abstract: "A cohort of 412 patients.",
    keywords: "",
    doi: null,
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    discipline: "Medicine",
  },
];
const PASSAGES = [
  { chunkId: "c1", articleId: "a1", articleTitle: "Mangroves and Storm Surge", chunkIndex: 2, text: "Restoration reduced storm-surge damage by 31.4% across 12 villages (n = 240)." },
  { chunkId: "c2", articleId: "a2", articleTitle: "Sepsis Detection in Rural Clinics", chunkIndex: 0, text: "Sepsis detection improved with the early warning score." },
];

describe("resolveCitations", () => {
  test("numbers citations in order of first use and groups sources by article", () => {
    const r = resolveCitations("Damage fell [P1]. Sepsis detection improved [P2]; both are recent [A1][P1].", PASSAGES, ARTICLES, [], BASE);
    expect(r.answer).toBe("Damage fell [1]. Sepsis detection improved [2]; both are recent [1][3].");
    expect(r.citations.map((c) => [c.n, c.kind, c.articleId, c.sourceN])).toEqual([
      [1, "passage", "a1", 1],
      [2, "passage", "a2", 2],
      [3, "record", "a1", 1],
    ]);
    expect(r.sources.map((s) => s.id)).toEqual(["a1", "a2"]);
    expect(r.sources[0].authors[0]).toEqual({ name: "Ana María Rivera", affiliation: "University of Dhaka" });
    expect(r.sources[0].keywords).toEqual(["mangroves", "storm surge"]);
    expect(r.droppedMarkers).toBe(0);
  });

  test("accepts [Passage 2], [P1, P2] and bare [2], and drops markers for evidence that wasn't supplied", () => {
    const r = resolveCitations("A [Passage 2]. B [P1, P2]. C [7]. D [A9].", PASSAGES, ARTICLES, [], BASE);
    expect(r.answer).toBe("A [1]. B [1][2]. C. D.");
    expect(r.droppedMarkers).toBe(2);
  });

  test("falls back to usedPassages when the model wrote no inline markers", () => {
    const r = resolveCitations("Damage fell.", PASSAGES, ARTICLES, [1], BASE);
    expect(r.citations).toHaveLength(1);
    expect(r.citations[0].chunkId).toBe("c1");
  });

  test("passage links scroll to the passage's words", () => {
    expect(passageUrl(BASE, "a1", PASSAGES[0].text, 2)).toBe(
      `${BASE}/article/a1#:~:text=${encodeURIComponent("reduced storm-surge damage by 31.4% across 12 villages")}`.replace("%25", "")
    );
  });
});

describe("apaReference", () => {
  test("builds an APA 7 reference from the record, with the DOI when there is one", () => {
    const [a, b] = resolveCitations("x [A1] [A2]", PASSAGES, ARTICLES, [], BASE).sources;
    expect(apaReference(a, { name: "Journal of Tests", volume: 3, issueNumber: 2 })).toBe(
      "Rivera, A. M., & Ito, B. (2025). Mangroves and Storm Surge. Journal of Tests, 3(2). https://doi.org/10.5555/ep.1"
    );
    expect(apaReference(b, { name: "Journal of Tests" })).toBe("Wei, C. (2026). Sepsis Detection in Rural Clinics. Journal of Tests. https://journal.example/article/a2");
  });
});

describe("verifyAnswer", () => {
  const evidence = [...PASSAGES.map((p) => p.text), "DOI: 10.5555/ep.1"];

  test("an answer whose specifics all appear in the evidence passes", () => {
    const r = verifyAnswer("Damage fell by 31.4% (n = 240), DOI 10.5555/ep.1 [1].", evidence, ["10.5555/ep.1"], true, 1);
    expect(r.check.status).toBe("verified");
    expect(r.answer).toContain("10.5555/ep.1");
  });

  test("removes invented DOIs and page numbers, unquotes unmatched quotations and flags unmatched figures", () => {
    const r = verifyAnswer(
      'The authors state "restoration completely eliminated all storm damage in every village" (p. 14). Damage fell by 45.2%. See 10.1234/invented.9 [1].',
      evidence,
      ["10.5555/ep.1"],
      true,
      1
    );
    expect(r.answer).not.toContain("10.1234/invented.9");
    expect(r.answer).not.toContain("p. 14");
    expect(r.answer).not.toContain('"restoration');
    expect(r.answer).toContain("restoration completely eliminated");
    expect(r.check.unverifiedFigures).toEqual(["45.2%"]);
    expect(r.check.status).toBe("review");
    expect(r.check.warnings).toHaveLength(4);
  });

  test("a verbatim quotation keeps its quote marks", () => {
    const r = verifyAnswer("They report that “Sepsis detection improved with the early warning score” [2].", evidence, [], true, 1);
    expect(r.answer).toContain("“Sepsis detection improved with the early warning score”");
    expect(r.check.status).toBe("verified");
  });

  test("an ungrounded answer is marked unsupported", () => {
    expect(verifyAnswer("The journal's records don't cover this.", evidence, [], false, 0).check.status).toBe("unsupported");
  });
});

test("stripModelReferenceList removes a bibliography the model wrote itself", () => {
  expect(stripModelReferenceList("Answer [1].\n\n### References\n1. Smith (2020). Made up.")).toBe("Answer [1].");
  expect(stripModelReferenceList("Answer.\n\n**Sources:**\n- x")).toBe("Answer.");
  expect(stripModelReferenceList("These sources agree.")).toBe("These sources agree.");
});

test("text between two quoted titles is not treated as a quotation", () => {
  const r = verifyAnswer('"Mangroves and Storm Surge" is compared here with the other study from the region, "Sepsis Detection in Rural Clinics".', ["Mangroves and Storm Surge", "Sepsis Detection in Rural Clinics"], [], true, 1);
  expect(r.answer).toBe('"Mangroves and Storm Surge" is compared here with the other study from the region, "Sepsis Detection in Rural Clinics".');
  expect(r.check.warnings).toHaveLength(0);
});
