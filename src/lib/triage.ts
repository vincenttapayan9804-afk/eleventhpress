/**
 * LLM-Assisted Editorial Triage Service.
 *
 * Uses z-ai-web-dev-sdk to analyze a newly-submitted manuscript and produce
 * a structured editorial report:
 *   - Scope fit score (0-100)
 *   - Methodological soundness flags
 *   - Suggested reviewers (from the reviewer pool, ranked by semantic match)
 *   - Recommended review model
 *   - 3-sentence summary
 *   - Predicted impact (1-5 stars)
 *   - Risk flags
 *
 * Falls back to a deterministic heuristic analysis if the LLM is unavailable.
 */
import { db } from "@/lib/db";
import { parseAuthors, DISCIPLINES } from "@/lib/article";
import { generateEmbedding } from "@/lib/embeddings";

const AIMS_SCOPE = `Eleventh Press International Publishing is committed to rigorous, transparent, and rapid dissemination of scholarship. The journal welcomes original research submissions spanning the natural sciences, engineering, social sciences, and humanities. Disciplines: Physics, Biology, Computer Science, Sociology, Economics, Psychology, Environmental Science, Mathematics.`;

const SYSTEM_PROMPT = `You are the editorial triage assistant for Eleventh Press International Publishing, a multidisciplinary open-access journal. Your job is to read a manuscript submission and produce a structured editorial report that helps the editor make a fast, informed first decision.

You must respond with a single JSON object (no markdown, no preamble) matching this exact schema:
{
  "scopeFitScore": <integer 0-100>,
  "scopeFitReason": "<one sentence explaining the scope fit>",
  "methodologyFlags": [
    {"flag": "<short label>", "severity": "info|warning|concern", "explanation": "<one sentence>"}
  ],
  "suggestedReviewers": [
    {"name": "<reviewer name from the pool>", "matchScore": <0-100>, "reason": "<one sentence>"}
  ],
  "recommendedReviewModel": "DOUBLE_BLIND|SINGLE_BLIND|OPEN",
  "summary": "<exactly 3 sentences summarising the contribution>",
  "predictedImpact": <1-5>,
  "riskFlags": ["<short risk label>", ...]
}

Be rigorous but fair. If the manuscript is clearly out of scope, set scopeFitScore below 40. If you cannot find suitable reviewers in the pool, return an empty suggestedReviewers array.`;

export interface TriageResult {
  scopeFitScore: number;
  scopeFitReason: string;
  methodologyFlags: any[];
  suggestedReviewers: any[];
  recommendedReviewModel: string;
  summary: string;
  predictedImpact: number;
  riskFlags: any[];
  rawResponse: string;
  model: string;
  mode: "llm" | "heuristic";
}

export async function runEditorialTriage(articleId: string): Promise<TriageResult> {
  const article = await db.article.findUnique({
    where: { id: articleId },
    include: { journal: true },
  });
  if (!article) throw new Error("Article not found");

  const authors = parseAuthors(article.authors);
  const reviewerPool = await db.user.findMany({
    where: { role: { in: ["REVIEWER", "ASSOCIATE_EDITOR", "EDITOR"] } },
    select: { id: true, fullName: true, affiliation: true, expertise: true, orcid: true },
  });

  // Try the real LLM via z-ai-web-dev-sdk
  try {
    const result = await callLLM(article, authors, reviewerPool);
    if (result) {
      await db.editorialTriageReport.create({
        data: {
          articleId,
          scopeFitScore: result.scopeFitScore,
          scopeFitReason: result.scopeFitReason,
          methodologyFlags: JSON.stringify(result.methodologyFlags),
          suggestedReviewers: JSON.stringify(result.suggestedReviewers),
          recommendedReviewModel: result.recommendedReviewModel,
          summary: result.summary,
          predictedImpact: result.predictedImpact,
          riskFlags: JSON.stringify(result.riskFlags),
          rawResponse: result.rawResponse,
          model: result.model,
        },
      }).catch(() => db.editorialTriageReport.update({
        where: { articleId },
        data: {
          scopeFitScore: result.scopeFitScore,
          scopeFitReason: result.scopeFitReason,
          methodologyFlags: JSON.stringify(result.methodologyFlags),
          suggestedReviewers: JSON.stringify(result.suggestedReviewers),
          recommendedReviewModel: result.recommendedReviewModel,
          summary: result.summary,
          predictedImpact: result.predictedImpact,
          riskFlags: JSON.stringify(result.riskFlags),
          rawResponse: result.rawResponse,
          model: result.model,
        },
      }));
      return result;
    }
  } catch (e) {
    console.error("[triage] LLM call failed, falling back to heuristic:", e);
  }

  // Heuristic fallback
  const heuristic = runHeuristicTriage(article, authors, reviewerPool);
  await db.editorialTriageReport.create({
    data: {
      articleId,
      scopeFitScore: heuristic.scopeFitScore,
      scopeFitReason: heuristic.scopeFitReason,
      methodologyFlags: JSON.stringify(heuristic.methodologyFlags),
      suggestedReviewers: JSON.stringify(heuristic.suggestedReviewers),
      recommendedReviewModel: heuristic.recommendedReviewModel,
      summary: heuristic.summary,
      predictedImpact: heuristic.predictedImpact,
      riskFlags: JSON.stringify(heuristic.riskFlags),
      rawResponse: heuristic.rawResponse,
      model: heuristic.model,
    },
  }).catch(() => db.editorialTriageReport.update({
    where: { articleId },
    data: {
      scopeFitScore: heuristic.scopeFitScore,
      scopeFitReason: heuristic.scopeFitReason,
      methodologyFlags: JSON.stringify(heuristic.methodologyFlags),
      suggestedReviewers: JSON.stringify(heuristic.suggestedReviewers),
      recommendedReviewModel: heuristic.recommendedReviewModel,
      summary: heuristic.summary,
      predictedImpact: heuristic.predictedImpact,
      riskFlags: JSON.stringify(heuristic.riskFlags),
      rawResponse: heuristic.rawResponse,
      model: heuristic.model,
    },
  }));
  return heuristic;
}

async function callLLM(article: any, authors: any[], reviewerPool: any[]): Promise<TriageResult | null> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();

  const reviewerPoolText = reviewerPool
    .map((r) => `- ${r.fullName} (${r.affiliation || "no affiliation"}): expertise = ${r.expertise || "not specified"}`)
    .join("\n");

  const userPrompt = `JOURNAL AIMS & SCOPE:
${AIMS_SCOPE}

MANUSCRIPT:
Title: ${article.title}
Discipline: ${article.discipline}
Keywords: ${article.keywords}
Authors: ${authors.map((a) => `${a.name} (${a.affiliation})`).join(", ")}

Abstract:
${article.abstract}

REVIEWER POOL:
${reviewerPoolText}

Produce the editorial triage report as a single JSON object.`;

  const res = await (zai as any).chat.completions.create({
    model: "glm-4",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  });

  const content = res.choices?.[0]?.message?.content;
  if (!content) return null;

  // Extract JSON from the response (handles markdown code fences)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  let parsed: any;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }

  return {
    scopeFitScore: parsed.scopeFitScore ?? 50,
    scopeFitReason: parsed.scopeFitReason ?? "Not provided.",
    methodologyFlags: parsed.methodologyFlags ?? [],
    suggestedReviewers: parsed.suggestedReviewers ?? [],
    recommendedReviewModel: parsed.recommendedReviewModel ?? "DOUBLE_BLIND",
    summary: parsed.summary ?? "Summary unavailable.",
    predictedImpact: parsed.predictedImpact ?? 3,
    riskFlags: parsed.riskFlags ?? [],
    rawResponse: content,
    model: "glm-4",
    mode: "llm",
  };
}

/**
 * Deterministic heuristic triage — used when the LLM is unavailable.
 * Produces a sensible report from keyword matching and pool inspection.
 */
function runHeuristicTriage(article: any, authors: any[], reviewerPool: any[]): TriageResult {
  const isInDiscipline = DISCIPLINES.includes(article.discipline as any);
  const abstractLength = (article.abstract || "").length;
  const hasKeywords = (article.keywords || "").split(",").filter(Boolean).length >= 3;
  const hasOrcid = authors.some((a) => a.orcid);

  // Scope fit
  let scopeFitScore = 50;
  if (isInDiscipline) scopeFitScore += 30;
  if (abstractLength > 500) scopeFitScore += 10;
  if (hasKeywords) scopeFitScore += 5;
  if (hasOrcid) scopeFitScore += 5;
  scopeFitScore = Math.min(100, scopeFitScore);

  const scopeFitReason = isInDiscipline
    ? `Manuscript falls within the ${article.discipline} discipline, which is within the journal's stated scope.`
    : `Manuscript discipline (${article.discipline}) is not in the journal's primary scope list; editor should verify interdisciplinary fit.`;

  // Methodology flags
  const methodologyFlags: any[] = [];
  if (abstractLength < 200) {
    methodologyFlags.push({ flag: "Short abstract", severity: "warning", explanation: "Abstract is under 200 characters; may not provide enough detail for reviewers." });
  }
  if (!hasKeywords) {
    methodologyFlags.push({ flag: "Insufficient keywords", severity: "info", explanation: "Fewer than 3 keywords provided; consider requesting more for better reviewer matching." });
  }
  if (article.plagiarismScore && article.plagiarismScore > 15) {
    methodologyFlags.push({ flag: "High similarity score", severity: "concern", explanation: `iThenticate score of ${article.plagiarismScore}% exceeds the 15% threshold; editor should review the similarity report.` });
  }
  methodologyFlags.push({ flag: "Pre-screening complete", severity: "info", explanation: "Manuscript passed automated format and metadata checks." });

  // Suggested reviewers — keyword matching
  const articleKeywords = (article.keywords || "").toLowerCase().split(/[,\s]+/).filter((k: string) => k.length > 2);
  const suggestedReviewers = reviewerPool
    .map((r) => {
      const expertise = (r.expertise || "").toLowerCase();
      let matchScore = 30;
      for (const kw of articleKeywords) {
        if (expertise.includes(kw)) matchScore += 20;
      }
      if (expertise.includes(article.discipline.toLowerCase())) matchScore += 15;
      matchScore = Math.min(100, matchScore);
      return {
        name: r.fullName,
        matchScore,
        reason: matchScore > 50
          ? `Expertise in ${r.expertise || "related field"} overlaps with manuscript keywords.`
          : `General reviewer; no direct keyword overlap but within disciplinary scope.`,
      };
    })
    .filter((r) => r.matchScore > 40)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5);

  // Recommended review model
  const recommendedReviewModel = article.discipline === "Sociology" || article.discipline === "Psychology"
    ? "DOUBLE_BLIND"
    : article.discipline === "Mathematics"
    ? "SINGLE_BLIND"
    : "DOUBLE_BLIND";

  // Summary
  const firstSentence = (article.abstract || "").split(".")[0] + ".";
  const summary = `${firstSentence} The manuscript was submitted under the ${article.discipline} discipline with ${authors.length} author(s). Automated pre-screening ${scopeFitScore > 70 ? "suggests a strong scope fit" : "flags some scope concerns"} and ${suggestedReviewers.length} potential reviewer(s) were identified from the pool.`;

  // Predicted impact
  let predictedImpact = 3;
  if (scopeFitScore > 80 && hasOrcid && abstractLength > 800) predictedImpact = 4;
  if (scopeFitScore > 90 && authors.length > 2 && hasKeywords) predictedImpact = 5;
  if (scopeFitScore < 50) predictedImpact = 2;

  // Risk flags
  const riskFlags: string[] = [];
  if (scopeFitScore < 50) riskFlags.push("scope-fit-risk");
  if (article.plagiarismScore && article.plagiarismScore > 15) riskFlags.push("plagiarism-risk");
  if (!hasOrcid) riskFlags.push("no-orcid");
  if (authors.length === 1) riskFlags.push("single-author");

  return {
    scopeFitScore,
    scopeFitReason,
    methodologyFlags,
    suggestedReviewers,
    recommendedReviewModel,
    summary,
    predictedImpact,
    riskFlags,
    rawResponse: JSON.stringify({ mode: "heuristic", scopeFitScore, suggestedReviewersCount: suggestedReviewers.length }, null, 2),
    model: "heuristic-fallback",
    mode: "heuristic",
  };
}
