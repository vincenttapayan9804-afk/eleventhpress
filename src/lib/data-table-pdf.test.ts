/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { extractTables } from "@/lib/data-tables";
import { buildDataTablePdf, describeNumericColumns, fitColumnWidths, dataTablePdfFileName } from "@/lib/data-table-pdf";

const article = {
  id: "art_1",
  title: "Personal Responsibility and Ataraxis in Physical Education",
  authors: JSON.stringify([{ name: "Maria Santos", affiliation: "University of the Philippines", email: "m@example.org" }]),
  doi: "10.52011/epip.2026.001",
  publishedAt: "2026-03-14T00:00:00Z",
  keywords: "physical education, self-efficacy",
  discipline: "Education",
  journalName: "EPIP International Journal of Multidisciplinary Research",
  journalIssn: "2945-1138",
  publisher: "Eleventh Press International Publishing™",
  volume: 5,
  issueNumber: 1,
  year: 2026,
  articleUrl: "https://eleventhpress.vercel.app/article/art_1",
};

describe("data table PDF", () => {
  test("renders a branded PDF for a survey-instrument table", async () => {
    const rows = Array.from({ length: 40 }, (_, i) => `<tr><td>${i + 1}.</td><td>Statement number ${i + 1} about the PE class</td><td></td><td></td><td></td><td></td><td></td></tr>`).join("");
    const [table] = extractTables(`<table><tr><td>A.</td><td>PERSONAL RESPONSIBILITY<br>In our PE class...</td><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td></tr>${rows}</table>`);
    const pdf = await buildDataTablePdf({ article, table, tableNumber: 1, tableCount: 2 });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5000);
  });

  test("computes descriptive statistics only from real values", () => {
    const [table] = extractTables(`<table><tr><th>Group</th><th>Score</th></tr><tr><td>A</td><td>2</td></tr><tr><td>B</td><td>4</td></tr><tr><td>C</td><td></td></tr></table>`);
    const [s] = describeNumericColumns(table);
    expect(s).toMatchObject({ name: "Score", n: 2, mean: 3, min: 2, max: 4 });
    expect(s.sd).toBeCloseTo(Math.SQRT2, 6);
  });

  test("column widths always fill exactly the available width", () => {
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
    expect(sum(fitColumnWidths([40, 60], [20, 30], 300))).toBeCloseTo(300);
    expect(sum(fitColumnWidths([400, 600], [40, 80], 300))).toBeCloseTo(300);
    expect(sum(fitColumnWidths([400, 600], [200, 300], 300))).toBeCloseTo(300);
  });

  test("file name is a readable slug", () => {
    expect(dataTablePdfFileName({ title: "Ataraxis & Self-Efficacy: A Study" }, 2)).toBe("ataraxis-self-efficacy-a-study-table-2.pdf");
  });
});
