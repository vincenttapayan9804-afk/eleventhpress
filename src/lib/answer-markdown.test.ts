import { describe, expect, test } from "bun:test";
import { outsideMathAndCode } from "./answer-markdown";

const link = (md: string) => outsideMathAndCode(md, (t) => t.replace(/\[(\d)\]/g, "[$1](cite:$1)"));

describe("outsideMathAndCode", () => {
  test("leaves equations and code fences alone", () => {
    expect(link("Score [1] is $$x_{[2]} = 1$$ and [3].")).toBe("Score [1](cite:1) is $$x_{[2]} = 1$$ and [3](cite:3).");
    expect(link("See [1].\n```mermaid\nflowchart TD\nA[Step [2]] --> B\n```\nThen [3].")).toBe(
      "See [1](cite:1).\n```mermaid\nflowchart TD\nA[Step [2]] --> B\n```\nThen [3](cite:3)."
    );
  });

  test("an unclosed fence (still being written) is left alone to the end", () => {
    expect(link("Text [1]\n```mermaid\nA[x [2]]")).toBe("Text [1](cite:1)\n```mermaid\nA[x [2]]");
  });

  test("dollar amounts are ordinary text", () => {
    expect(link("It cost $5 [1] and $10 [2].")).toBe("It cost $5 [1](cite:1) and $10 [2](cite:2).");
  });
});
