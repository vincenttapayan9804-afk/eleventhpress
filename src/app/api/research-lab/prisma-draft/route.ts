import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { draftSystematicReview } from "@/lib/prisma-draft";
import { parseExternalSources } from "@/lib/research-gap-finder";

const RESEARCH_LAB_ROLES = ["AUTHOR", "EXPERT", "REVIEWER", "EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"];
const MAX_ARTICLES_PER_REQUEST = 20;
const MAX_EXTERNAL_PER_REQUEST = 8;

/**
 * POST /api/research-lab/prisma-draft
 * Drafts a systematic-review scaffold from a set of "included studies" —
 * this platform's own published articles and/or external sources
 * (hand-pasted or picked from the open-data source search, see
 * /api/discover). Only persists a ResearchLabDocument on a real LLM
 * success, same convention as the gap-analysis route.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!RESEARCH_LAB_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Not available for this role" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { articleIds?: string[]; externalSources?: unknown };
  const articleIds = (body.articleIds ?? []).filter((s) => typeof s === "string").slice(0, MAX_ARTICLES_PER_REQUEST);
  const externalSources = parseExternalSources(body.externalSources, MAX_EXTERNAL_PER_REQUEST);
  if (articleIds.length === 0 && externalSources.length === 0) {
    return NextResponse.json({ error: "Select at least one included study" }, { status: 400 });
  }

  const result = await draftSystematicReview({ articleIds, externalSources });

  if (result.mode === "llm") {
    await db.researchLabDocument.create({
      data: {
        userId: session.userId,
        kind: "PRISMA_DRAFT",
        title: `Review draft — ${result.sources.length} included stud${result.sources.length === 1 ? "y" : "ies"}`,
        inputJson: JSON.stringify({ articleIds, externalSources }),
        resultJson: JSON.stringify({ sources: result.sources, draft: result.draft }),
        model: result.model,
      },
    });
  }

  return NextResponse.json(result);
}

/**
 * GET /api/research-lab/prisma-draft
 * Returns the caller's own saved review-draft history.
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
    where: { userId: session.userId, kind: "PRISMA_DRAFT" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return NextResponse.json({
    documents: docs.map((d) => ({ ...d, result: JSON.parse(d.resultJson) })),
  });
}
