import { describe, expect, test } from "bun:test";
import { isGrounded, splitAnswer, usedPassagesFromMarkers, visibleLength } from "./answer-format";

describe("splitAnswer", () => {
  test("separates the answer from its follow-up questions", () => {
    const r = splitAnswer("Damage fell by 30% [P1].\n\nFOLLOW-UPS:\n- How was damage measured?\n2. Who were the participants?\n\n");
    expect(r.answer).toBe("Damage fell by 30% [P1].");
    expect(r.followUps).toEqual(["How was damage measured?", "Who were the participants?"]);
  });

  test("tolerates Markdown decoration and a missing colon on the marker line", () => {
    expect(splitAnswer("A.\n**Follow-ups**\n- Q1").followUps).toEqual(["Q1"]);
    expect(splitAnswer("A.\n### FOLLOW-UPS:\n* Q2").followUps).toEqual(["Q2"]);
  });

  test("an answer without the section is returned whole", () => {
    expect(splitAnswer("Just an answer.")).toEqual({ answer: "Just an answer.", followUps: [] });
  });

  test("the word inside a sentence is not mistaken for the marker", () => {
    expect(splitAnswer("Researchers did follow-ups: two waves.").answer).toBe("Researchers did follow-ups: two waves.");
  });
});

describe("visibleLength", () => {
  test("stops before the follow-ups section", () => {
    const text = "Answer text.\nFOLLOW-UPS:\n- Q";
    expect(text.slice(0, visibleLength(text))).toBe("Answer text.");
  });

  test("holds back a last line that may be the start of the marker", () => {
    const text = "Answer text.\nFOLLOW-";
    expect(text.slice(0, visibleLength(text))).toBe("Answer text.\n");
  });

  test("shows ordinary text in full", () => {
    const text = "Answer text.\nThe study found";
    expect(visibleLength(text)).toBe(text.length);
  });
});

describe("usedPassagesFromMarkers", () => {
  test("collects passage numbers in order of first use, ignoring record markers", () => {
    expect(usedPassagesFromMarkers("A [P3]. B [P1, P3][A2]. C [Passage 7]; D [P1].")).toEqual([3, 1, 7]);
  });

  test("ignores bracketed text that isn't a marker", () => {
    expect(usedPassagesFromMarkers("See [Table 2] and [n = 48].")).toEqual([]);
  });
});

describe("isGrounded", () => {
  test("the agreed opening marks an answer the records don't cover", () => {
    expect(isGrounded("The journal's records don't cover this. The closest article is …")).toBe(false);
    expect(isGrounded("The journal’s records don’t cover this.")).toBe(false);
  });

  test("anything else is grounded", () => {
    expect(isGrounded("The study found a 30% reduction [P1].")).toBe(true);
    expect(isGrounded("The journal's records don't state the sample size, but …")).toBe(true);
  });
});
