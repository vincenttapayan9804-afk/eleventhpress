/**
 * Systematic Review / PRISMA drafting tool (Eleventh Research Lab) —
 * drafts a structured review scaffold (rationale, literature matrix,
 * synthesis, limitations, discussion points, references) from a
 * researcher-selected set of "included studies" — this platform's own
 * published articles and/or external sources (hand-pasted or picked from
 * the open-data source search, see src/app/api/discover/route.ts).
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
 * the exact same extraction/formatting machinery as research-gap-
 * finder.ts's matrix — references are never LLM-generated, only ever
 * built deterministically (formatCitation() for internal articles, a
 * best-effort real-metadata equivalent for external sources), so a
 * citation's accuracy never depends on the model getting it right.
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

export interface PrismaDraftResult {
  sources: PrismaDraftSource[];
  skippedUrls: { url: string; reason: string }[];
  draft: string;
  mode: "llm" | "unavailable";
  reason?: "insufficient_sources" | "no_provider" | "call_failed";
  model?: string;
}

const PRISMA_SYSTEM_PROMPT =
  "You are a research assistant helping a scholar draft the scaffold of a systematic review from a set of included studies, in the standard literature-review-matrix format (research design, participants, population/sample, locale/setting, theoretical framework, methodology, key findings, conclusions, recommendations). Extract every matrix field strictly from what's stated in that study's own excerpt — write exactly 'Not stated in the source material provided.' for any field the excerpt doesn't actually address; never infer, guess, or invent a finding, statistic, or study detail that isn't in the source material. This is a first-draft scaffold for the researcher to revise, not a finished review. Every narrative section must be substantive, not a placeholder: real studies on a shared topic almost always differ in population, context, methodology, scope, timeframe, or emphasis, so 'Synthesis of Findings' and 'Limitations' should surface concrete differences and weaknesses rather than defaulting to generic statements like 'no significant differences were found' — only say that if the material genuinely gives no basis for anything more specific.";

function markdownTableCell(text: string): string {
  return (text || "—").replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
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
    return `| ${markdownTableCell(s.title)} | ${markdownTableCell(m.researchDesign)} | ${markdownTableCell(m.participants)} | ${markdownTableCell(m.population)} | ${markdownTableCell(m.locale)} | ${markdownTableCell(m.theoreticalFramework)} | ${markdownTableCell(m.methodology)} | ${markdownTableCell(m.keyFindings)} | ${markdownTableCell(m.conclusions)} | ${markdownTableCell(m.recommendations)} |`;
  });
  const referencesList = sources
    .map((s) => s.matrix.reference)
    .sort((a, b) => a.localeCompare(b))
    .join("\n\n");
  return { matrixTable: [header, ...rows].join("\n"), referencesList };
}

export async function draftSystematicReview(input: {
  articleIds: string[];
  externalSources: ExternalSourceInput[];
}): Promise<PrismaDraftResult> {
  const sources: PrismaDraftSource[] = await fetchInternalSources(input.articleIds);
  const skippedUrls: { url: string; reason: string }[] = [];

  for (const ext of input.externalSources) {
    const resolved = await resolveExternalSource(ext);
    if ("source" in resolved) sources.push(resolved.source);
    else skippedUrls.push(resolved.skipped);
  }

  if (sources.length === 0) {
    return { sources, skippedUrls, draft: "", mode: "unavailable", reason: "insufficient_sources" };
  }
  if (!anyLLMAvailable()) {
    return { sources, skippedUrls, draft: "", mode: "unavailable", reason: "no_provider" };
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
        `Respond with a single JSON object: {"rationale": "<why this review area matters, grounded in the studies — ` +
        `and note that a search-strategy and formal eligibility-criteria section still needs to be written by hand, ` +
        `this draft only covers the studies actually provided>", "sourceAnalyses": [<one entry per study, in order, ` +
        `each shaped exactly like ${SOURCE_ANALYSIS_FIELD_SCHEMA}>], "synthesis": "<at least 2-3 concrete points of ` +
        `agreement, disagreement, or differing scope/population/methodology across the studies>", "limitations": ` +
        `"<at least 2-3 concrete gaps or weaknesses evident across the set>", "discussionPoints": [<at least 3 ` +
        `strings, each a concrete next step a researcher could pursue>]}`,
      4000
    );

    const mergedSources = mergeSourceAnalyses(sources, data.sourceAnalyses);
    const { matrixTable, referencesList } = buildMatrixAndReferences(mergedSources);
    const discussionPoints = (data.discussionPoints ?? []).map((p) => `- ${p}`).join("\n");

    const draft =
      `## Rationale\n${data.rationale?.trim() ?? ""}\n\n` +
      `## Literature Matrix\n${matrixTable}\n\n` +
      `## Synthesis of Findings\n${data.synthesis?.trim() ?? ""}\n\n` +
      `## Limitations\n${data.limitations?.trim() ?? ""}\n\n` +
      `## Suggested Discussion Points\n${discussionPoints}\n\n` +
      `## References\n${referencesList}`;

    return { sources: mergedSources, skippedUrls, draft, mode: "llm", model };
  } catch (e) {
    console.error("[prisma-draft] LLM call failed:", e);
    return { sources, skippedUrls, draft: "", mode: "unavailable", reason: "call_failed" };
  }
}
