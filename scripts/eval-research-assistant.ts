/**
 * End-to-end eval of the Research Assistant against a deployment: asks each
 * question in a file through /api/corpus-chat (streamed, as the site does)
 * and reports timing, grounding, evidence-check status and whether the
 * expected articles were cited. Complements the deterministic retrieval
 * golden set in src/lib/research-golden.test.ts, which runs in CI.
 *
 * It calls real models, so it isn't part of CI. Each question uses the
 * assistant's normal quota and rate limits; keep the file short or raise
 * --delay.
 *
 * Questions file (JSON):
 *   [
 *     { "question": "What did the TLE motivation study find?", "expect": ["10.5072/epip.2026.014"] },
 *     { "question": "Compare the reading and mathematics anxiety studies." }
 *   ]
 * "expect" (optional) lists DOIs, article ids or title fragments that should
 * be among the cited sources.
 *
 * Usage:
 *   bun run scripts/eval-research-assistant.ts --url https://preview.example.vercel.app --file questions.json
 *   bun run scripts/eval-research-assistant.ts --url … --file … --delay 8000 --json results.json
 *
 * A protected Vercel preview needs VERCEL_AUTOMATION_BYPASS_SECRET in the environment.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

interface Question {
  question: string;
  expect?: string[];
}

interface Row {
  question: string;
  status: number;
  mode: string;
  totalMs: number;
  firstTextMs: number | null;
  grounded: boolean | null;
  evidence: string | null;
  warnings: number;
  citations: number;
  sources: string[];
  expectedFound: number | null;
  expectedTotal: number;
  model: string | null;
  error?: string;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const base = (arg("--url") ?? "").replace(/\/+$/, "");
const file = arg("--file");
const delay = Number(arg("--delay") ?? 5000);
const jsonOut = arg("--json");
if (!base || !file) {
  console.error("Usage: bun run scripts/eval-research-assistant.ts --url <deployment> --file <questions.json> [--delay ms] [--json out.json]");
  process.exit(1);
}

const questions = JSON.parse(readFileSync(file, "utf8")) as Question[];
if (!Array.isArray(questions) || questions.some((q) => typeof q?.question !== "string")) {
  console.error("The questions file must be a JSON array of { question, expect? }.");
  process.exit(1);
}

// Double-submit CSRF: the same random value as cookie and header (src/proxy.ts).
const csrf = randomBytes(24).toString("hex");
const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Accept: "application/x-ndjson, application/json",
  Cookie: `epip_csrf=${csrf}`,
  "x-csrf-token": csrf,
  "User-Agent": "EPIP-Research-Eval/1.0",
};
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
if (bypass) headers["x-vercel-protection-bypass"] = bypass;

const matches = (expect: string, source: { id?: string; doi?: string | null; title?: string }) => {
  const e = expect.toLowerCase();
  return source.id === expect || (source.doi ?? "").toLowerCase() === e || (source.title ?? "").toLowerCase().includes(e);
};

async function ask(q: Question): Promise<Row> {
  const started = Date.now();
  let firstTextMs: number | null = null;
  const row: Row = {
    question: q.question,
    status: 0,
    mode: "error",
    totalMs: 0,
    firstTextMs: null,
    grounded: null,
    evidence: null,
    warnings: 0,
    citations: 0,
    sources: [],
    expectedFound: null,
    expectedTotal: q.expect?.length ?? 0,
    model: null,
  };
  try {
    const res = await fetch(`${base}/api/corpus-chat`, { method: "POST", headers, body: JSON.stringify({ question: q.question, history: [] }) });
    row.status = res.status;
    let result: any = null;
    if ((res.headers.get("content-type") ?? "").includes("ndjson") && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (value) buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === "delta" && firstTextMs === null) firstTextMs = Date.now() - started;
            if (msg.type === "result") result = msg;
          } catch {
            // a partial line; the next read completes it
          }
        }
        if (done) break;
      }
    } else {
      result = await res.json().catch(() => null);
    }
    row.totalMs = Date.now() - started;
    row.firstTextMs = firstTextMs;
    if (!res.ok || !result) {
      row.error = result?.error ?? `HTTP ${res.status}`;
      return row;
    }
    const sources: any[] = Array.isArray(result.sources) ? result.sources : [];
    row.mode = result.mode ?? "answered";
    row.grounded = typeof result.grounded === "boolean" ? result.grounded : null;
    row.evidence = result.evidence?.status ?? null;
    row.warnings = Array.isArray(result.evidence?.warnings) ? result.evidence.warnings.length : 0;
    row.citations = Array.isArray(result.citations) ? result.citations.length : 0;
    row.sources = sources.map((s) => s.title ?? s.id);
    row.model = result.model ?? null;
    if (q.expect?.length) row.expectedFound = q.expect.filter((e) => sources.some((s) => matches(e, s))).length;
  } catch (e) {
    row.totalMs = Date.now() - started;
    row.error = e instanceof Error ? e.message : String(e);
  }
  return row;
}

const pct = (xs: number[], p: number) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const secs = (ms: number | null) => (ms === null ? "–" : `${(ms / 1000).toFixed(1)}s`);

async function main() {
  const rows: Row[] = [];
  for (const [i, q] of questions.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, delay));
    const row = await ask(q);
    rows.push(row);
    const expected = row.expectedTotal ? ` · expected ${row.expectedFound ?? 0}/${row.expectedTotal}` : "";
    console.log(
      `${String(i + 1).padStart(2)}. ${row.error ? `ERROR ${row.error}` : `${row.mode} · ${row.evidence ?? "–"} · ${row.citations} citations`} · first text ${secs(row.firstTextMs)} · total ${secs(row.totalMs)}${expected}\n    ${q.question}`
    );
  }

  const ok = rows.filter((r) => !r.error);
  const withExpect = ok.filter((r) => r.expectedTotal > 0);
  const found = withExpect.reduce((s, r) => s + (r.expectedFound ?? 0), 0);
  const wanted = withExpect.reduce((s, r) => s + r.expectedTotal, 0);
  console.log("\nSummary");
  console.log(`  answered        ${ok.length}/${rows.length}`);
  console.log(`  grounded        ${ok.filter((r) => r.grounded).length}/${ok.length}`);
  console.log(`  verified        ${ok.filter((r) => r.evidence === "verified").length}/${ok.length} (review: ${ok.filter((r) => r.evidence === "review").length})`);
  console.log(`  source recall   ${wanted ? `${found}/${wanted} (${((found / wanted) * 100).toFixed(0)}%)` : "–"}`);
  console.log(`  first text      median ${secs(pct(ok.flatMap((r) => (r.firstTextMs === null ? [] : [r.firstTextMs])), 50))}, p95 ${secs(pct(ok.flatMap((r) => (r.firstTextMs === null ? [] : [r.firstTextMs])), 95))}`);
  console.log(`  total           median ${secs(pct(ok.map((r) => r.totalMs), 50))}, p95 ${secs(pct(ok.map((r) => r.totalMs), 95))}`);
  const models = [...new Set(ok.map((r) => r.model).filter(Boolean))];
  if (models.length) console.log(`  models          ${models.join(", ")}`);
  if (jsonOut) {
    writeFileSync(jsonOut, JSON.stringify(rows, null, 2));
    console.log(`\nWrote ${jsonOut}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
