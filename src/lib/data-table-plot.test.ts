/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { extractTables } from "@/lib/data-tables";
import { buildPlot, truncateLabel } from "@/lib/data-table-plot";

const longRows = Array.from({ length: 15 }, (_, i) => `<tr><td>${i + 1}.</td><td>The work I do in PE class is personally meaningful to me (${i})</td><td>${i % 4}</td><td>${i % 3 ? i : ""}</td></tr>`).join("");
const [crowded] = extractTables(`<table><tr><th>No.</th><th>Statement</th><th>Agree</th><th>Disagree</th></tr>${longRows}</table>`);
const [simple] = extractTables(`<table><tr><th>Group</th><th>Score</th></tr><tr><td>A</td><td>1</td></tr><tr><td>B</td><td>2</td></tr></table>`);

describe("buildPlot", () => {
  test("long labels turn a bar chart horizontal, one readable label per row", () => {
    const p = buildPlot(crowded, "bar");
    expect(p.horizontal).toBe(true);
    const yaxis = p.layout.yaxis as { ticktext: string[]; automargin: boolean };
    expect(yaxis.ticktext).toHaveLength(15);
    expect(yaxis.automargin).toBe(true);
    expect(yaxis.ticktext.every((s) => s.length <= 34)).toBe(true);
  });

  test("line/scatter thin and angle crowded ticks; numbering is never a series", () => {
    const p = buildPlot(crowded, "line", { width: 380 });
    const xaxis = p.layout.xaxis as { ticktext: string[]; tickangle: number };
    expect(xaxis.ticktext.length).toBeLessThanOrEqual(6);
    expect(xaxis.tickangle).toBeLessThan(0);
    expect(p.data.map((d) => d.name)).toEqual(["Agree", "Disagree"]);
  });

  test("blank cells are gaps, not zeros; legend sits above the plot", () => {
    const p = buildPlot(crowded, "scatter");
    expect((p.data[1] as { y: (number | null)[] }).y[0]).toBeNull();
    expect(p.layout.showlegend).toBe(true);
    expect(p.layout.legend?.yanchor).toBe("bottom");
  });

  test("a single short series stays vertical with no legend", () => {
    const p = buildPlot(simple, "bar");
    expect(p.horizontal).toBe(false);
    expect(p.layout.showlegend).toBe(false);
  });

  test("truncateLabel adds an ellipsis only when needed", () => {
    expect(truncateLabel("short", 10)).toBe("short");
    expect(truncateLabel("a much longer label", 10)).toBe("a much lo…");
  });
});
