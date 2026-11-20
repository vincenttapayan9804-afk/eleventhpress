import { describe, expect, test } from "bun:test";
import { outsideJournal, relatedWorkQuery, titleMatches } from "./related-work";
import type { DiscoveryResult } from "./open-discovery";

describe("relatedWorkQuery", () => {
  test("keeps the topic words of the question, without question phrasing", () => {
    expect(relatedWorkQuery("What do the studies say about mangrove restoration and storm surge in Bangladesh?")).toBe(
      "mangrove restoration storm surge Bangladesh"
    );
  });

  test("tops up a vague question with the cited articles' keywords", () => {
    expect(relatedWorkQuery("What did they find?", ["mangroves", "storm surge", "coastal adaptation"])).toBe("mangroves storm surge coastal adaptation");
  });

  test("doesn't repeat a term, and caps the length", () => {
    expect(relatedWorkQuery("Mangroves and mangroves", ["Mangroves", "wetlands"])).toBe("Mangroves wetlands");
    expect(relatedWorkQuery("x".repeat(400)).length).toBeLessThanOrEqual(200);
  });
});

describe("outsideJournal", () => {
  const r = (doi: string | null, title = "T"): DiscoveryResult => ({ source: "openalex", title, authors: "", year: 2024, venue: null, doi, url: "https://x", openAccessUrl: null });

  test("drops the journal's own articles by DOI, case-insensitively, and caps the list", () => {
    const out = outsideJournal([r("10.5555/OWN.1"), r("10.1/other"), r(null, "No DOI")], ["10.5555/own.1"]);
    expect(out.map((x) => x.doi)).toEqual(["10.1/other", null]);
    expect(outsideJournal([r("a"), r("b"), r("c")], [], 2)).toHaveLength(2);
  });
});

describe("ranking by the question", () => {
  const r = (title: string, source: DiscoveryResult["source"] = "crossref"): DiscoveryResult => ({ source, title, authors: "", year: 2024, venue: null, doi: null, url: `https://x/${title}`, openAccessUrl: null });
  const query = "institutional support affect students motivation TLE";

  test("counts shared words, allowing word endings to differ", () => {
    expect(titleMatches("Student Engagement and Teaching Motivation among TLE Students", query)).toBe(3);
    expect(titleMatches("Motivated learners", "motivation")).toBe(1);
    expect(titleMatches("Deja Vu in Temporal-Lobe Epilepsy", query)).toBe(0);
  });

  test("the closest titles come first, and unrelated ones drop out", () => {
    const out = outsideJournal(
      [
        r("Students' Engagement in Ultimate Frisbee"),
        r("Deja Vu in Temporal-Lobe Epilepsy", "eric"),
        r("Institutional Support and Student Motivation in TLE", "openalex"),
        r("Motivation of Students in TLE", "openalex"),
      ],
      [],
      12,
      query
    );
    expect(out.map((x) => x.title)).toEqual([
      "Institutional Support and Student Motivation in TLE",
      "Motivation of Students in TLE",
      "Students' Engagement in Ultimate Frisbee",
    ]);
  });

  test("a rare topic word outweighs words every title shares", () => {
    const list = [
      r("Students' Motivation in Online Classes"),
      r("Students and Motivation: A Survey of Schools"),
      r("Student Attendance and Motivation"),
      r("Motivation in TLE Laboratory Classes"),
    ];
    const out = outsideJournal(list, [], 12, "TLE students motivation");
    expect(out[0].title).toBe("Motivation in TLE Laboratory Classes");
  });
});
