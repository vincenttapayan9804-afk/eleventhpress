/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { extractTables, isChartable } from "@/lib/data-tables";

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
