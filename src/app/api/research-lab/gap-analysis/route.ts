import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { findResearchGaps, parseExternalSources } from "@/lib/research-gap-finder";

const RESEARCH_LAB_ROLES = ["AUTHOR", "EXPERT", "REVIEWER", "EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"];
const MAX_SOURCES_PER_REQUEST = 8;

/**
 * POST /api/research-lab/gap-analysis
 * Runs the Research Gap Finder over a mix of this platform's own
 * published articles and researcher-pasted external URLs. Only persists a
 * ResearchLabDocument when the LLM actually produced a result — never on
 * an "unavailable" run, same cache-but-only-on-success convention as
 * related-explanation.ts.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!RESEARCH_LAB_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Not available for this role" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    internalArticleIds?: string[];
    externalSources?: unknown;
  };
  const internalArticleIds = (body.internalArticleIds ?? []).filter((s) => typeof s === "string").slice(0, MAX_SOURCES_PER_REQUEST);
  const externalSources = parseExternalSources(body.externalSources, MAX_SOURCES_PER_REQUEST);

  if (internalArticleIds.length + externalSources.length < 2) {
    return NextResponse.json({ error: "Provide at least two sources (internal articles and/or external sources)" }, { status: 400 });
  }

  const result = await findResearchGaps({ internalArticleIds, externalSources });

  if (result.mode === "llm") {
    await db.researchLabDocument.create({
      data: {
        userId: session.userId,
        kind: "GAP_ANALYSIS",
        title: `Gap analysis — ${result.sources.length} source(s)`,
        inputJson: JSON.stringify({ internalArticleIds, externalSources }),
        resultJson: JSON.stringify({ sources: result.sources, overview: result.overview, gaps: result.gaps }),
        model: result.model,
      },
    });
  }

  return NextResponse.json(result);
}

/**
 * GET /api/research-lab/gap-analysis
 * Returns the caller's own saved gap-analysis history.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!RESEARCH_LAB_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Not available for this role" }, { status: 403 });
  }

  const docs = await db.researchLabDocument.findMany({
    where: { userId: session.userId, kind: "GAP_ANALYSIS" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return NextResponse.json({
    documents: docs.map((d) => ({ ...d, result: JSON.parse(d.resultJson) })),
  });
}
