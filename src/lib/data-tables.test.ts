/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { extractTables, isChartable, chartRows, parseNumericCell } from "@/lib/data-tables";

describe("extractTables", () => {
  test("returns no tables for HTML with none", () => {
    expect(extractTables("<p>No tables here.</p>")).toEqual([]);
  });

  test("extracts headers and rows from a well-formed table", () => {
    const html = `
      <table>
        <tr><th>Year</th><th>Count</th></tr>
        <tr><td>2020</td><td>12</td></tr>
        <tr><td>2021</td><td>18</td></tr>
      </table>
    `;
    const tables = extractTables(html);
    expect(tables).toHaveLength(1);
    expect(tables[0].headers).toEqual(["Year", "Count"]);
    expect(tables[0].rows).toEqual([
      ["2020", "12"],
      ["2021", "18"],
    ]);
  });

  test("identifies numeric columns and skips a non-numeric label column", () => {
    const html = `
      <table>
        <tr><th>Group</th><th>Score</th></tr>
        <tr><td>Control</td><td>3.4</td></tr>
        <tr><td>Treatment</td><td>7.8</td></tr>
      </table>
    `;
    const [table] = extractTables(html);
    expect(table.numericColumns).toEqual([1]);
    expect(isChartable(table)).toBe(true);
  });

  test("a table with no numeric columns is not chartable", () => {
    const html = `
      <table>
        <tr><th>Name</th><th>Affiliation</th></tr>
        <tr><td>Ada</td><td>University A</td></tr>
        <tr><td>Alan</td><td>University B</td></tr>
      </table>
    `;
    const [table] = extractTables(html);
    expect(table.numericColumns).toEqual([]);
    expect(isChartable(table)).toBe(false);
  });

  test("a single data row is not chartable even with a numeric column", () => {
    const html = `<table><tr><th>Year</th><th>Count</th></tr><tr><td>2020</td><td>12</td></tr></table>`;
    const [table] = extractTables(html);
    expect(isChartable(table)).toBe(false);
  });

  test("decodes common HTML entities in cell text", () => {
    const html = `<table><tr><th>A &amp; B</th></tr><tr><td>50%</td></tr><tr><td>60%</td></tr></table>`;
    const [table] = extractTables(html);
    expect(table.headers).toEqual(["A & B"]);
  });

  test("handles multiple tables independently", () => {
    const html = `
      <table><tr><th>X</th></tr><tr><td>1</td></tr><tr><td>2</td></tr></table>
      <p>Some text between tables.</p>
      <table><tr><th>Y</th></tr><tr><td>3</td></tr><tr><td>4</td></tr></table>
    `;
    const tables = extractTables(html);
    expect(tables).toHaveLength(2);
    expect(tables[0].headers).toEqual(["X"]);
    expect(tables[1].headers).toEqual(["Y"]);
  });
});

describe("survey-instrument tables (section rows, row numbering)", () => {
  // Mirrors a real Likert instrument: the "1 2 3 4 5" scale is restated
  // under each section heading, items are numbered "1.", "2.", and the
  // response cells are blank.
  const html = `
    <table>
      <tr><td>A.</td><td><p>PERSONAL RESPONSIBILITY</p><p>In our Physical Education class...</p></td><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td></tr>
      <tr><td>1.</td><td>I try hard</td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td>2.</td><td>I want to improve</td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td>B.</td><td>SELF-EFFICACY<br>In our Physical Education class...</td><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td></tr>
      <tr><td>3.</td><td>I feel capable of success in PE class.</td><td></td><td></td><td></td><td></td><td></td></tr>
    </table>`;

  test("keeps words on separate lines apart", () => {
    const [t] = extractTables(html);
    expect(t.headers[1]).toBe("PERSONAL RESPONSIBILITY In our Physical Education class...");
    expect(t.rows[2][1]).toBe("SELF-EFFICACY In our Physical Education class...");
  });

  test("marks restated-scale rows as sections and never charts numbering or blanks", () => {
    const [t] = extractTables(html);
    expect(t.sectionRows).toEqual([2]);
    expect(t.numericColumns).toEqual([]);
    expect(t.labelColumn).toBe(1);
    expect(isChartable(t)).toBe(false);
  });
});

describe("chart rows", () => {
  test("a numbered results table charts its measures, labelled by the text column", () => {
    const html = `
      <table>
        <tr><th>#</th><th>Statement</th><th>Mean</th><th>SD</th></tr>
        <tr><td>1</td><td>I try hard</td><td>4.21</td><td>0.66</td></tr>
        <tr><td>2</td><td>I want to improve</td><td>4.35</td><td>0.59</td></tr>
        <tr><td>3</td><td>I give a good effort</td><td></td><td></td></tr>
      </table>`;
    const [t] = extractTables(html);
    expect(t.numericColumns).toEqual([2, 3]);
    expect(t.labelColumn).toBe(1);
    expect(chartRows(t)).toEqual([0, 1]);
    expect(isChartable(t)).toBe(true);
  });

  test("a leading year column labels the rows instead of being plotted", () => {
    const html = `<table><tr><th>Year</th><th>Count</th></tr><tr><td>2019</td><td>4</td></tr><tr><td>2020</td><td>9</td></tr></table>`;
    const [t] = extractTables(html);
    expect(t.labelColumn).toBe(0);
    expect(t.numericColumns).toEqual([1]);
    expect(isChartable(t)).toBe(true);
  });

  test("reads the table caption", () => {
    const [t] = extractTables(`<table><caption>Table 2. Scores</caption><tr><th>G</th><th>S</th></tr><tr><td>a</td><td>1.5</td></tr></table>`);
    expect(t.caption).toBe("Table 2. Scores");
    expect(parseNumericCell("12.5%")).toBe(12.5);
    expect(parseNumericCell("")).toBeNull();
  });
});
