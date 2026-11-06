/**
 * Builds the Plotly traces + layout for a Supplemental-tab data table
 * (src/components/data-tables/data-table-chart.tsx). Pure, so the layout
 * rules are unit-tested rather than eyeballed:
 *
 *  - Rows are positioned by index, never by their label text, so two rows
 *    with the same (or same-truncated) label never merge into one category.
 *  - Long or numerous labels never overlap: bar charts turn horizontal
 *    (labels read left-to-right, one per line, chart grows with the rows);
 *    line/scatter charts angle and thin their ticks, truncate them with an
 *    ellipsis, and Plotly's automargin reserves room for them.
 *  - The legend sits above the plot area, clear of every tick label, and is
 *    dropped for a single series (the axis title names it instead).
 *  - Blank or non-numeric cells are gaps (null), never invented zeros.
 *  - The full row label and value are always in the hover tooltip.
 */
import type { Data, Layout } from "plotly.js";
import { chartRows, parseNumericCell } from "@/lib/data-tables";

export type ChartType = "bar" | "line" | "scatter";

export interface PlotTable {
  headers: string[];
  rows: string[][];
  numericColumns: number[];
  sectionRows?: number[];
  labelColumn?: number;
}

/** Validated categorical palette (fixed order, never cycled past 8). */
const SERIES_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const SERIES_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
export const MAX_SERIES = SERIES_LIGHT.length;

export function truncateLabel(label: string, max: number): string {
  const s = label.replace(/\s+/g, " ").trim();
  return s.length <= max ? s : `${s.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Wraps hover text so a long statement doesn't become a screen-wide tooltip. */
function wrapForHover(s: string, width = 48): string {
  const words = escapeHtml(s).split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (line && (line + " " + w).length > width) {
      lines.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push(line);
  return lines.join("<br>");
}

/** Falls back to the legacy shape (no labelColumn) — first non-numeric column. */
function resolveLabelColumn(t: PlotTable): number {
  if (typeof t.labelColumn === "number") return t.labelColumn;
  return t.headers.findIndex((_, i) => !t.numericColumns.includes(i));
}

export function buildPlot(
  table: PlotTable,
  chartType: ChartType,
  opts: { dark?: boolean; width?: number } = {}
): { data: Data[]; layout: Partial<Layout>; height: number; horizontal: boolean } {
  const dark = !!opts.dark;
  const narrow = (opts.width ?? 800) < 520;
  const palette = dark ? SERIES_DARK : SERIES_LIGHT;
  const ink = dark ? "#e7e4ee" : "#2e2742";
  const muted = dark ? "#a6a0b5" : "#6b6478";
  const grid = dark ? "rgba(255,255,255,0.08)" : "rgba(36,27,58,0.08)";
  const surface = dark ? "#16131f" : "#ffffff";

  const rowIdx = chartRows(table);
  const labelCol = resolveLabelColumn(table);
  const labels = rowIdx.map((r) => {
    const v = labelCol >= 0 ? (table.rows[r][labelCol] || "").trim() : "";
    return v || `Row ${r + 1}`;
  });
  const series = table.numericColumns.slice(0, MAX_SERIES);
  const longest = labels.reduce((m, l) => Math.max(m, l.length), 0);
  const crowded = longest > 12 || rowIdx.length > 8;
  const horizontal = chartType === "bar" && crowded;
  const positions = rowIdx.map((_, i) => i);

  // Thin the ticks on dense line/scatter charts so labels never collide.
  const maxTicks = narrow ? 6 : 14;
  const step = horizontal ? 1 : Math.max(1, Math.ceil(positions.length / maxTicks));
  const tickPositions = positions.filter((p) => p % step === 0);
  const tickMax = horizontal ? (narrow ? 22 : 34) : crowded ? 16 : 20;
  const tickText = tickPositions.map((p) => truncateLabel(labels[p], tickMax));
  const hoverLabels = labels.map((l) => wrapForHover(l));

  const data: Data[] = series.map((col, s) => {
    const name = table.headers[col]?.trim() || `Column ${col + 1}`;
    const values = rowIdx.map((r) => parseNumericCell(table.rows[r][col]));
    const color = palette[s];
    const valueAxis = horizontal ? "x" : "y";
    const base = {
      name: truncateLabel(name, 28),
      customdata: hoverLabels,
      hovertemplate: `<b>%{customdata}</b><br>${escapeHtml(truncateLabel(name, 40))}: %{${valueAxis}}<extra></extra>`,
    };
    if (chartType === "bar") {
      return {
        ...base,
        type: "bar",
        orientation: horizontal ? "h" : "v",
        x: horizontal ? values : positions,
        y: horizontal ? positions : values,
        marker: { color, line: { width: 0 } },
      } as Data;
    }
    return {
      ...base,
      type: "scatter",
      mode: chartType === "line" ? "lines+markers" : "markers",
      x: positions,
      y: values,
      connectgaps: false,
      line: { color, width: 2 },
      marker: { color, size: chartType === "line" ? 8 : 10, line: { color: surface, width: 2 } },
    } as Data;
  });

  const multi = series.length > 1;
  const singleName = series.length === 1 ? truncateLabel(table.headers[series[0]] || "Value", 40) : "";
  const categoryAxis = {
    tickmode: "array" as const,
    tickvals: tickPositions,
    ticktext: tickText,
    automargin: true,
    showgrid: false,
    zeroline: false,
    linecolor: grid,
    ticks: "" as const,
    tickfont: { size: 11, color: muted },
    fixedrange: true,
  };
  const valueAxis = {
    automargin: true,
    gridcolor: grid,
    zeroline: false,
    tickfont: { size: 11, color: muted },
    title: multi ? undefined : { text: singleName, font: { size: 11, color: muted } },
    rangemode: "tozero" as const,
    fixedrange: true,
  };

  const perRow = horizontal ? Math.max(24, 10 * series.length + 12) : 0;
  const legendRows = multi ? Math.ceil(series.length / (narrow ? 2 : 4)) : 0;
  const top = 12 + legendRows * 22;
  const angle = !horizontal && crowded ? (narrow ? -55 : -35) : 0;
  const height = horizontal
    ? Math.min(1600, Math.max(260, rowIdx.length * perRow + top + 60))
    : 320 + (angle ? 60 : 0) + legendRows * 10;

  const layout: Partial<Layout> = {
    autosize: true,
    height,
    margin: { t: top, r: 16, b: 16, l: 16, pad: 4 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { size: 11, family: "inherit", color: ink },
    showlegend: multi,
    legend: { orientation: "h", x: 0, xanchor: "left", y: 1, yanchor: "bottom", font: { size: 11, color: ink }, bgcolor: "rgba(0,0,0,0)" },
    hovermode: "closest",
    hoverlabel: { bgcolor: surface, bordercolor: grid, font: { color: ink, size: 12 }, align: "left" },
    bargap: 0.28,
    bargroupgap: 0.08,
    barmode: "group",
    xaxis: horizontal ? valueAxis : { ...categoryAxis, tickangle: angle, range: [-0.6, positions.length - 0.4] },
    yaxis: horizontal ? { ...categoryAxis, autorange: "reversed" } : valueAxis,
  };

  return { data, layout, height, horizontal };
}
