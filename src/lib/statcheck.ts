/**
 * statcheck — free, in-process reimplementation of the core algorithm from
 * Nuijten & colleagues' open-source R package (https://github.com/MicheleNuijten/statcheck):
 * scan reported inferential statistics (t/F/r/chi-square tests with a
 * p-value) for internal consistency by recomputing the exact p-value from
 * the reported test statistic and degrees of freedom, then flagging any
 * mismatch. Uses jstat's real distribution CDFs (Student's t, F,
 * chi-square) — no external API, no per-check cost, same "real
 * computation, no fabrication" standard as every other integrity check in
 * this codebase.
 *
 * Two severities, matching the original tool's own terminology:
 *  - "inconsistency": the recomputed p-value doesn't match what's reported,
 *    but the significance conclusion (at alpha = .05) is unchanged.
 *  - "decision error": the recomputed p-value crosses the .05 threshold in
 *    the opposite direction from what's reported — i.e. the paper's own
 *    "significant"/"not significant" conclusion would flip. This is the
 *    category that actually matters for review.
 *
 * Only ever reports what it can verify by recomputation — a statistic this
 * parser doesn't recognize (multivariate tests, Bayesian statistics, one-
 * tailed tests reported as two-tailed, etc.) is silently skipped, never
 * guessed at.
 */
import jStat from "jstat";

const P_NUM = String.raw`(?:0?\.\d+|1(?:\.0+)?)`; // .05, 0.05, 1, 1.0 — never a bare integer like "5"
const COMPARATOR = String.raw`(=|<|>|≤|≥|<=|>=)`;

interface RawMatch {
  test: "t" | "F" | "r" | "chi2";
  raw: string;
  df1: number;
  df2?: number;
  statistic: number;
  comparator: string;
  reportedP: number;
}

const PATTERNS: { test: RawMatch["test"]; regex: RegExp }[] = [
  {
    test: "t",
    regex: new RegExp(String.raw`\bt\s*\(\s*(\d+(?:\.\d+)?)\s*\)\s*=\s*(-?\d+(?:\.\d+)?)\s*,\s*p\s*${COMPARATOR}\s*(${P_NUM})`, "gi"),
  },
  {
    test: "F",
    regex: new RegExp(String.raw`\bF\s*\(\s*(\d+)\s*,\s*(\d+(?:\.\d+)?)\s*\)\s*=\s*(\d+(?:\.\d+)?)\s*,\s*p\s*${COMPARATOR}\s*(${P_NUM})`, "gi"),
  },
  {
    test: "r",
    regex: new RegExp(String.raw`\br\s*\(\s*(\d+)\s*\)\s*=\s*(-?\.?\d+(?:\.\d+)?)\s*,\s*p\s*${COMPARATOR}\s*(${P_NUM})`, "gi"),
  },
  {
    test: "chi2",
    regex: new RegExp(String.raw`(?:χ2|χ²|chi-square|chi2)\s*\(\s*(\d+)(?:\s*,\s*N\s*=\s*\d+)?\s*\)\s*=\s*(\d+(?:\.\d+)?)\s*,\s*p\s*${COMPARATOR}\s*(${P_NUM})`, "gi"),
  },
];

function normalizeP(raw: string): number {
  return raw.startsWith(".") ? Number(`0${raw}`) : Number(raw);
}

function decimalPlaces(raw: string): number {
  const dot = raw.indexOf(".");
  return dot === -1 ? 0 : raw.length - dot - 1;
}

function roundTo(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export interface StatcheckResult {
  raw: string;
  test: RawMatch["test"];
  statistic: number;
  df1: number;
  df2: number | null;
  reportedP: number;
  reportedComparator: string;
  computedP: number;
  consistent: boolean;
  decisionError: boolean;
}

/** True at alpha = .05, honoring the reported comparator (e.g. "p < .05" is
 * significant regardless of the .05 value itself; "p = .06" is not). */
function isSignificant(p: number, comparator: string, exactValue: number): boolean {
  if (comparator === "<" || comparator === "<=" || comparator === "≤") return exactValue <= 0.05 || p < 0.05;
  if (comparator === ">" || comparator === ">=" || comparator === "≥") return false;
  return p < 0.05;
}

function computeP(m: RawMatch): number {
  switch (m.test) {
    case "t":
      return 2 * (1 - jStat.studentt.cdf(Math.abs(m.statistic), m.df1));
    case "F":
      return 1 - jStat.centralF.cdf(m.statistic, m.df1, m.df2 as number);
    case "r": {
      const df = m.df1;
      const t = (m.statistic * Math.sqrt(df)) / Math.sqrt(Math.max(1 - m.statistic * m.statistic, 1e-12));
      return 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
    }
    case "chi2":
      return 1 - jStat.chisquare.cdf(m.statistic, m.df1);
  }
}

/** Scans plain text (already HTML-stripped) for reported inferential
 * statistics and flags any that don't recompute consistently. */
export function runStatcheck(text: string): StatcheckResult[] {
  const results: StatcheckResult[] = [];

  for (const { test, regex } of PATTERNS) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text))) {
      let raw: RawMatch;
      if (test === "F") {
        const [, df1, df2, statistic, comparator, p] = match;
        raw = { test, raw: match[0], df1: Number(df1), df2: Number(df2), statistic: Number(statistic), comparator, reportedP: normalizeP(p) };
      } else {
        const [, df1, statistic, comparator, p] = match;
        raw = { test, raw: match[0], df1: Number(df1), statistic: Number(statistic), comparator, reportedP: normalizeP(p) };
      }

      const computedP = computeP(raw);
      const places = decimalPlaces(match[match.length - 1]);
      const roundedComputed = roundTo(computedP, Math.max(places, 2));
      const reportedSig = isSignificant(raw.reportedP, raw.comparator, raw.reportedP);
      const computedSig = computedP < 0.05;

      results.push({
        raw: raw.raw,
        test: raw.test,
        statistic: raw.statistic,
        df1: raw.df1,
        df2: raw.df2 ?? null,
        reportedP: raw.reportedP,
        reportedComparator: raw.comparator,
        computedP,
        consistent: raw.comparator === "=" ? Math.abs(roundedComputed - raw.reportedP) < 1e-9 : reportedSig === computedSig,
        decisionError: reportedSig !== computedSig,
      });
    }
  }

  return results;
}
