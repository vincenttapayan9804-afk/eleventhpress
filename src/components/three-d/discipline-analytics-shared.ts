/**
 * Types, metric definitions, scales and theme colours shared by the 3D
 * discipline analytics scene (WebGL, lazy-loaded) and its panel (plain DOM,
 * main bundle). Deliberately free of three/@react-three imports so the panel
 * can use it without pulling the WebGL chunk in.
 */

export interface DisciplineStat {
  discipline: string;
  articles: number;
  citations: number;
  views: number;
  /** At least one article in the discipline has a registered DOI. */
  indexed: boolean;
}

export type AnalyticsView = "bars" | "scatter";
export type AnalyticsMetric = "articles" | "citations" | "views" | "citationsPerArticle";

export interface MetricDef {
  label: string;
  axisTitle: string;
  value: (s: DisciplineStat) => number;
  format: (n: number) => string;
}

const fmtInt = (n: number) => Math.round(n).toLocaleString();
const fmtRatio = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export const METRICS: Record<AnalyticsMetric, MetricDef> = {
  articles: { label: "Articles", axisTitle: "Published articles", value: (s) => s.articles, format: fmtInt },
  citations: { label: "Citations", axisTitle: "Citations", value: (s) => s.citations, format: fmtInt },
  views: { label: "Views", axisTitle: "Views", value: (s) => s.views, format: fmtInt },
  citationsPerArticle: {
    label: "Citations / article",
    axisTitle: "Citations per article",
    value: (s) => (s.articles > 0 ? s.citations / s.articles : 0),
    format: fmtRatio,
  },
};

export const METRIC_ORDER: AnalyticsMetric[] = ["articles", "citations", "views", "citationsPerArticle"];

const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
export function formatCompact(n: number): string {
  return Math.abs(n) < 1000 ? (Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1)) : compact.format(n);
}

/** 0-based "nice" ticks (1/2/2.5/5 × 10^k steps) covering `max`. */
export function niceTicks(max: number, target = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
  const top = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  return ticks;
}

export function shortDisciplineName(name: string): string {
  return name
    .replace("Environmental Science", "Env. Science")
    .replace("Computer Science", "Computer Sci.")
    .replace("Language and Literature", "Lang. & Lit.");
}

/**
 * Mark colours validated with the dataviz palette checker (lightness band,
 * chroma floor, CVD + normal-vision separation, ≥3:1 vs surface) for each
 * mode's surface: one brand hue for every discipline (they're nominal — a
 * value ramp would just double-encode height) plus a gold accent reserved
 * for the "DOI-registered" marker, always paired with a legend entry and a
 * table column so it's never colour-alone.
 */
export const CHART_THEME = {
  light: {
    mark: "#6f44bc",
    accent: "#B8862F",
    grid: "#d9d3ea",
    axis: "#a89cc9",
    floor: "#f3f0fb",
    shadow: "#3D1A5C",
  },
  dark: {
    mark: "#9d78ed",
    accent: "#B8862F",
    grid: "#2c2742",
    axis: "#4a4268",
    floor: "#14121f",
    shadow: "#000000",
  },
} as const;
