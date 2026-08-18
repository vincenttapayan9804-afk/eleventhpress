import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { draftSystematicReview } from "@/lib/prisma-draft";
import { parseExternalSources } from "@/lib/research-gap-finder";

const RESEARCH_LAB_ROLES = ["AUTHOR", "EXPERT", "REVIEWER", "EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"];
const MAX_ARTICLES_PER_REQUEST = 20;
const MAX_EXTERNAL_PER_REQUEST = 8;
const MAX_EXCLUDED_PER_REQUEST = 20;
const MAX_FREETEXT_CHARS = 4000;

function parseExcludedSources(raw: unknown): { label: string; reason: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as any;
      const label = typeof o.label === "string" ? o.label.trim() : "";
      const reason = typeof o.reason === "string" ? o.reason.trim() : "";
      return label ? { label: label.slice(0, 300), reason: reason.slice(0, 500) } : null;
    })
    .filter((s): s is { label: string; reason: string } => s !== null)
    .slice(0, MAX_EXCLUDED_PER_REQUEST);
}

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

  const body = (await req.json().catch(() => ({}))) as {
    articleIds?: string[];
    externalSources?: unknown;
    eligibilityCriteria?: string;
    searchStrategy?: string;
    excludedSources?: unknown;
  };
  const articleIds = (body.articleIds ?? []).filter((s) => typeof s === "string").slice(0, MAX_ARTICLES_PER_REQUEST);
  const externalSources = parseExternalSources(body.externalSources, MAX_EXTERNAL_PER_REQUEST);
  const excludedSources = parseExcludedSources(body.excludedSources);
  const eligibilityCriteria = typeof body.eligibilityCriteria === "string" ? body.eligibilityCriteria.slice(0, MAX_FREETEXT_CHARS) : undefined;
  const searchStrategy = typeof body.searchStrategy === "string" ? body.searchStrategy.slice(0, MAX_FREETEXT_CHARS) : undefined;
  if (articleIds.length === 0 && externalSources.length === 0) {
    return NextResponse.json({ error: "Select at least one included study" }, { status: 400 });
  }

  const result = await draftSystematicReview({ articleIds, externalSources, eligibilityCriteria, searchStrategy, excludedSources });

  let documentId: string | undefined;
  if (result.mode === "llm") {
    const doc = await db.researchLabDocument.create({
      data: {
        userId: session.userId,
        kind: "PRISMA_DRAFT",
        title: `Review draft — ${result.sources.length} included stud${result.sources.length === 1 ? "y" : "ies"}`,
        inputJson: JSON.stringify({ articleIds, externalSources, eligibilityCriteria, searchStrategy, excludedSources }),
        resultJson: JSON.stringify({ sources: result.sources, draft: result.draft, flowCounts: result.flowCounts, screeningLog: result.screeningLog }),
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
        metadata: JSON.stringify({ kind: "PRISMA_DRAFT", sourceCount: result.sources.length }),
      },
    });
  }

  return NextResponse.json({ ...result, documentId });
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

  // Tier 3: also surface documents a collaborator shared with this user.
  const shares = await db.researchLabDocumentShare.findMany({
    where: { sharedWithUserId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const sharedDocs = shares.length
    ? await db.researchLabDocument.findMany({
        where: { id: { in: shares.map((s) => s.documentId) }, kind: "PRISMA_DRAFT" },
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
