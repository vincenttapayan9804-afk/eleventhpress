/**
 * Systematic Review / PRISMA drafting tool (Eleventh Research Lab) —
 * drafts a structured review scaffold (eligibility criteria, search
 * strategy, PRISMA flow diagram, literature matrix, synthesis,
 * limitations, discussion points, references) from a researcher-selected
 * set of "included studies" — this platform's own published articles
 * and/or external sources (hand-pasted or picked from the open-data
 * source search, see src/app/api/discover/route.ts) — plus, optionally,
 * a researcher-declared eligibility/search-strategy and a list of
 * candidate sources excluded at screening with reasons.
 *
 * This genuinely implements the core of PRISMA 2020's reporting
 * structure rather than just borrowing its section names: eligibility
 * criteria and search strategy are the researcher's own words (never
 * LLM-generated — this platform can't invent a real search strategy it
 * didn't run), and the flow-diagram counts and per-source screening log
 * are computed deterministically from what was actually provided, so the
 * result is reproducible and auditable, not narrative flavor text.
 *
 * Same real-or-nothing contract as research-gap-finder.ts: a fabricated
 * draft would waste a researcher's time worse than no draft at all, so
 * there's no heuristic fallback — mode is "llm" or "unavailable". Purely
 * advisory output into an editable field, same "AI suggests, human
 * decides" pattern as decision-letter-draft.ts — never auto-submitted or
 * treated as a finished review. Cost-first (free OpenRouter tier before
 * any billed Anthropic call) with a single retry on a transient failure —
 * same reliability fix as research-gap-finder.ts.
 *
 * The Literature Matrix (research design, participants, population/
 * sample, locale/setting, theoretical framework, methodology, key
 * findings, conclusions, recommendations) and the References list use
 * the exact same extraction/verification/formatting machinery as
 * research-gap-finder.ts's matrix — references are never LLM-generated,
 * only ever built deterministically (formatCitation() for internal
 * articles, a best-effort real-metadata equivalent for external
 * sources), and every matrix cell's claimed supporting quote is checked
 * against that source's own excerpt (verifyQuote()) before being
 * rendered, so a citation or extracted claim's accuracy never depends on
 * the model getting it right unchecked.
 */
import {
  chatJSONWithRetry,
  fetchInternalSources,
  resolveExternalSource,
  mergeSourceAnalyses,
  type ExternalSourceInput,
  type GapAnalysisSource,
  type RawSourceAnalysis,
  SOURCE_ANALYSIS_FIELD_SCHEMA,
} from "@/lib/research-gap-finder";
import { anyLLMAvailable } from "@/lib/llm";

export type PrismaDraftSource = GapAnalysisSource;

export interface ExcludedSource {
  /** Free-text label (title, citation, or URL) — excluded candidates were
   * never fetched/analyzed, so this is exactly what the researcher typed,
   * never inferred. */
  label: string;
  reason: string;
}

export interface PrismaFlowCounts {
  /** Total candidate sources considered before screening: included
   * studies + excluded-at-screening + not-retrievable. */
  recordsIdentified: number;
  recordsExcludedAtScreening: number;
  reportsSoughtForRetrieval: number;
  reportsNotRetrieved: number;
  studiesIncluded: number;
}

export interface ScreeningLogEntry {
  label: string;
  decision: "included" | "excluded_at_screening" | "not_retrieved";
  reason: string;
}

export interface PrismaDraftResult {
  sources: PrismaDraftSource[];
  skippedUrls: { url: string; reason: string }[];
  draft: string;
  flowCounts: PrismaFlowCounts;
  screeningLog: ScreeningLogEntry[];
  mode: "llm" | "unavailable";
  reason?: "insufficient_sources" | "no_provider" | "call_failed";
  model?: string;
}

const PRISMA_SYSTEM_PROMPT =
  "You are a research assistant helping a scholar draft the scaffold of a systematic review from a set of included studies, in the standard literature-review-matrix format (research design, participants, population/sample, locale/setting, theoretical framework, methodology, key findings, conclusions, recommendations). Extract every matrix field strictly from what's stated in that study's own excerpt — write exactly 'Not stated in the source material provided.' for any field the excerpt doesn't actually address (leave quote empty in that case); never infer, guess, or invent a finding, statistic, or study detail that isn't in the source material. For every other field, quote must be a short (under 200 characters) verbatim excerpt copied exactly from that study's own text that proves the value. This is a first-draft scaffold for the researcher to revise, not a finished review. Every narrative section must be substantive, not a placeholder: real studies on a shared topic almost always differ in population, context, methodology, scope, timeframe, or emphasis, so 'Synthesis of Findings' and 'Limitations' should surface concrete differences and weaknesses rather than defaulting to generic statements like 'no significant differences were found' — only say that if the material genuinely gives no basis for anything more specific.";

function markdownTableCell(text: string): string {
  return (text || "—").replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

/** Renders one matrix cell's value with a verification marker so a
 * researcher can tell at a glance which extracted claims were confirmed
 * against the source's own text (✓) versus couldn't be (⚠) — the marker
 * travels with the value even once copied out of this platform, since the
 * draft is plain markdown text, not an interactive UI element. */
function cellWithVerification(field: { value: string; verified: boolean }): string {
  if (!field.value) return "—";
  return field.verified ? `${field.value} ✓` : `${field.value} ⚠️`;
}

/** Builds the Literature Matrix table and References list deterministically
 * from the resolved+analyzed sources — never from LLM output — so the two
 * most fact-sensitive parts of the draft can't be hallucinated. */
function buildMatrixAndReferences(sources: PrismaDraftSource[]): { matrixTable: string; referencesList: string } {
  const header =
    "| Study | Research Design | Participants | Population/Sample | Locale/Setting | Theoretical Framework | Methodology | Key Findings | Conclusions | Recommendations |\n" +
    "|---|---|---|---|---|---|---|---|---|---|";
  const rows = sources.map((s) => {
    const m = s.matrix;
    return `| ${markdownTableCell(s.title)} | ${markdownTableCell(cellWithVerification(m.researchDesign))} | ${markdownTableCell(cellWithVerification(m.participants))} | ${markdownTableCell(cellWithVerification(m.population))} | ${markdownTableCell(cellWithVerification(m.locale))} | ${markdownTableCell(cellWithVerification(m.theoreticalFramework))} | ${markdownTableCell(cellWithVerification(m.methodology))} | ${markdownTableCell(cellWithVerification(m.keyFindings))} | ${markdownTableCell(cellWithVerification(m.conclusions))} | ${markdownTableCell(cellWithVerification(m.recommendations))} |`;
  });
  const referencesList = sources
    .map((s) => s.matrix.reference)
    .sort((a, b) => a.localeCompare(b))
    .join("\n\n");
  return { matrixTable: [header, ...rows].join("\n"), referencesList };
}

/** Renders the PRISMA 2020-style flow diagram as a plain-text box flow —
 * markdown has no native diagram syntax, and a plain, universally-legible
 * text flow survives being copied into any editor, unlike an image or a
 * mermaid block a plain-text reviewer's editor may not render. */
function renderFlowDiagram(counts: PrismaFlowCounts): string {
  const lines = [
    `Records identified (candidate sources considered): ${counts.recordsIdentified}`,
    counts.recordsExcludedAtScreening > 0
      ? `  └─ Excluded at screening: ${counts.recordsExcludedAtScreening} (see screening log below)`
      : null,
    `Reports sought for retrieval: ${counts.reportsSoughtForRetrieval}`,
    counts.reportsNotRetrieved > 0
      ? `  └─ Reports not retrieved (full text unreadable/inaccessible): ${counts.reportsNotRetrieved}`
      : null,
    `Studies included in review: ${counts.studiesIncluded}`,
  ].filter((l): l is string => l !== null);
  return lines.join("\n");
}

function renderScreeningLog(log: ScreeningLogEntry[]): string {
  if (log.length === 0) return "_No excluded or unretrievable candidates were recorded for this run._";
  const header = "| Candidate | Decision | Reason |\n|---|---|---|";
  const rows = log.map(
    (e) => `| ${markdownTableCell(e.label)} | ${e.decision.replace(/_/g, " ")} | ${markdownTableCell(e.reason)} |`
  );
  return [header, ...rows].join("\n");
}

export async function draftSystematicReview(input: {
  articleIds: string[];
  externalSources: ExternalSourceInput[];
  eligibilityCriteria?: string;
  searchStrategy?: string;
  excludedSources?: ExcludedSource[];
}): Promise<PrismaDraftResult> {
  const excludedSources = input.excludedSources ?? [];
  const sources: PrismaDraftSource[] = await fetchInternalSources(input.articleIds);
  const skippedUrls: { url: string; reason: string }[] = [];

  for (const ext of input.externalSources) {
    const resolved = await resolveExternalSource(ext);
    if ("source" in resolved) sources.push(resolved.source);
    else skippedUrls.push(resolved.skipped);
  }

  const screeningLog: ScreeningLogEntry[] = [
    ...sources.map((s): ScreeningLogEntry => ({ label: s.title, decision: "included", reason: "Met eligibility criteria" })),
    ...skippedUrls.map((s): ScreeningLogEntry => ({ label: s.url, decision: "not_retrieved", reason: s.reason })),
    ...excludedSources.map((e): ScreeningLogEntry => ({ label: e.label, decision: "excluded_at_screening", reason: e.reason || "No reason recorded" })),
  ];
  const flowCounts: PrismaFlowCounts = {
    recordsIdentified: sources.length + skippedUrls.length + excludedSources.length,
    recordsExcludedAtScreening: excludedSources.length,
    reportsSoughtForRetrieval: sources.length + skippedUrls.length,
    reportsNotRetrieved: skippedUrls.length,
    studiesIncluded: sources.length,
  };

  if (sources.length === 0) {
    return { sources, skippedUrls, draft: "", flowCounts, screeningLog, mode: "unavailable", reason: "insufficient_sources" };
  }
  if (!anyLLMAvailable()) {
    return { sources, skippedUrls, draft: "", flowCounts, screeningLog, mode: "unavailable", reason: "no_provider" };
  }

  try {
    const list = sources.map((s, i) => `[${i + 1}] ${s.title}\n${s.excerpt}`).join("\n\n---\n\n");
    const { data, model } = await chatJSONWithRetry<{
      rationale: string;
      sourceAnalyses: RawSourceAnalysis[];
      synthesis: string;
      limitations: string;
      discussionPoints: string[];
    }>(
      PRISMA_SYSTEM_PROMPT,
      `Draft a systematic-review scaffold from these ${sources.length} included studies:\n\n${list}\n\n` +
        `Respond with a single JSON object: {"rationale": "<why this review area matters, grounded in the studies>", ` +
        `"sourceAnalyses": [<one entry per study, in order, each shaped exactly like ${SOURCE_ANALYSIS_FIELD_SCHEMA}>], ` +
        `"synthesis": "<at least 2-3 concrete points of agreement, disagreement, or differing scope/population/` +
        `methodology across the studies>", "limitations": "<at least 2-3 concrete gaps or weaknesses evident across ` +
        `the set>", "discussionPoints": [<at least 3 strings, each a concrete next step a researcher could pursue>]}`,
      4000
    );

    const mergedSources = mergeSourceAnalyses(sources, data.sourceAnalyses);
    const { matrixTable, referencesList } = buildMatrixAndReferences(mergedSources);
    const discussionPoints = (data.discussionPoints ?? []).map((p) => `- ${p}`).join("\n");
    const eligibilityCriteria = input.eligibilityCriteria?.trim() || "_Not recorded for this run — add before submitting for review._";
    const searchStrategy = input.searchStrategy?.trim() || "_Not recorded for this run — add before submitting for review._";

    const draft =
      `## Eligibility Criteria\n${eligibilityCriteria}\n\n` +
      `## Search Strategy\n${searchStrategy}\n\n` +
      `## PRISMA Flow Diagram\n${renderFlowDiagram(flowCounts)}\n\n` +
      `## Screening Log\n${renderScreeningLog(screeningLog)}\n\n` +
      `## Rationale\n${data.rationale?.trim() ?? ""}\n\n` +
      `## Literature Matrix\n${matrixTable}\n\n_✓ = quoted evidence confirmed in the source's own text. ⚠️ = the model's claimed quote could not be verified against the source excerpt — check this cell by hand before relying on it._\n\n` +
      `## Synthesis of Findings\n${data.synthesis?.trim() ?? ""}\n\n` +
      `## Limitations\n${data.limitations?.trim() ?? ""}\n\n` +
      `## Suggested Discussion Points\n${discussionPoints}\n\n` +
      `## References\n${referencesList}`;

    return { sources: mergedSources, skippedUrls, draft, flowCounts, screeningLog, mode: "llm", model };
  } catch (e) {
    console.error("[prisma-draft] LLM call failed:", e);
    return { sources, skippedUrls, draft: "", flowCounts, screeningLog, mode: "unavailable", reason: "call_failed" };
  }
}
