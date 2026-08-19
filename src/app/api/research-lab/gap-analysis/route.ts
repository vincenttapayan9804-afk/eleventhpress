import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { findResearchGaps, parseExternalSources } from "@/lib/research-gap-finder";
import { checkResearcherQuota } from "@/lib/researcher-quota";
import { RESEARCH_MODULE_KEYS } from "@/lib/researcher-plans";

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

  // Researcher SaaS Phase 1 — gated only once an account has an explicit
  // researchPlan; every pre-existing account (null plan) stays unlimited.
  const quota = await checkResearcherQuota(session.userId, RESEARCH_MODULE_KEYS.GAP_ANALYSIS);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: `Monthly gap-analysis limit reached for your plan (${quota.used}/${quota.limit}). Upgrade or wait for next month.` },
      { status: 429 }
    );
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

  let documentId: string | undefined;
  if (result.mode === "llm") {
    const doc = await db.researchLabDocument.create({
      data: {
        userId: session.userId,
        kind: "GAP_ANALYSIS",
        title: `Gap analysis — ${result.sources.length} source(s)`,
        inputJson: JSON.stringify({ internalArticleIds, externalSources }),
        resultJson: JSON.stringify({ sources: result.sources, overview: result.overview, gaps: result.gaps }),
        model: result.model,
      },
    });
    documentId = doc.id;
    await db.auditLog.create({
      data: {
        userId: session.userId,
        action: "RESEARCH_LAB_DOCUMENT_CREATED",
        entityType: "RESEARCH_LAB_DOCUMENT",
        entityId: doc.id,
        metadata: JSON.stringify({ kind: "GAP_ANALYSIS", sourceCount: result.sources.length }),
      },
    });
  }

  return NextResponse.json({ ...result, documentId });
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

  // Tier 3: also surface documents a collaborator shared with this user —
  // read-only team access, see research-lab-access.ts.
  const shares = await db.researchLabDocumentShare.findMany({
    where: { sharedWithUserId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const sharedDocs = shares.length
    ? await db.researchLabDocument.findMany({
        where: { id: { in: shares.map((s) => s.documentId) }, kind: "GAP_ANALYSIS" },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const ownerIds = [...new Set(sharedDocs.map((d) => d.userId))];
  const owners = ownerIds.length ? await db.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, fullName: true, email: true } }) : [];
  const ownerById = new Map(owners.map((u) => [u.id, u]));

  return NextResponse.json({
    documents: docs.map((d) => ({ ...d, result: JSON.parse(d.resultJson) })),
    sharedDocuments: sharedDocs.map((d) => ({ ...d, result: JSON.parse(d.resultJson), owner: ownerById.get(d.userId) ?? null })),
  });
}
