import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { checkSimilarity } from "@/lib/manuscript-checks";

/**
 * POST /api/articles/submit
 * Author submits a new manuscript. Triggers:
 *  - Draft DOI minting (mock Crossref)
 *  - In-corpus similarity check (real cosine-similarity against this
 *    journal's existing articles — see src/lib/manuscript-checks.ts)
 *  - Anonymization key generation (if double-blind)
 *  - Audit log + notification to editors
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!["AUTHOR", "EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Only AUTHOR role may submit manuscripts" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      title, abstract, keywords, discipline, authors, reviewModel, manuscriptKey, manuscriptName, openReview,
      funders, apcWaiverRequested, apcWaiverReason, references,
    } = body as {
      title: string;
      abstract: string;
      keywords: string;
      discipline: string;
      authors: any[];
      reviewModel: "DOUBLE_BLIND" | "SINGLE_BLIND" | "OPEN";
      manuscriptKey?: string;
      manuscriptName?: string;
      openReview?: boolean;
      funders?: any[];
      apcWaiverRequested?: boolean;
      apcWaiverReason?: string;
      references?: string[];
    };

    if (!title || !abstract || !discipline || !authors?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Find journal
    const journal = await db.journal.findFirst();
    if (!journal) {
      return NextResponse.json({ error: "Journal not configured" }, { status: 500 });
    }

    // Mint draft DOI (mock Crossref)
    const doiSuffix = Math.floor(Math.random() * 90000) + 10000;
    const draftDoi = `10.52011/epip.draft.${doiSuffix}`;

    // Real in-corpus similarity check (see src/lib/manuscript-checks.ts)
    const similarity = await checkSimilarity(`${title}. ${abstract}`);
    const plagiarismScore = similarity.score;

    // If double-blind, we generate the anonymised copy by stripping author
    // metadata from the uploaded PDF. In the sandbox we just record the key
    // path so reviewers receive a separate URL.
    const anonymizedKey = reviewModel === "DOUBLE_BLIND"
      ? (manuscriptKey ? manuscriptKey.replace("raw-submissions", "anonymized-manuscripts").replace(/\.([^.]+)$/, "-anon.$1") : `anonymized-manuscripts/anon-${doiSuffix}.pdf`)
      : null;

    const article = await db.article.create({
      data: {
        journalId: journal.id,
        doi: draftDoi,
        doiStatus: "DRAFT",
        title,
        abstract,
        keywords,
        discipline,
        authors: JSON.stringify(authors),
        correspondingAuthorId: session.userId,
        manuscriptKey: manuscriptKey || (manuscriptName ? `raw-submissions/${session.userId}/${manuscriptName}` : `raw-submissions/${discipline.toLowerCase().replace(/\s+/g, "-")}-${doiSuffix}.pdf`),
        anonymizedKey,
        status: "SUBMITTED",
        reviewModel,
        openReview: openReview ?? false,
        plagiarismScore,
        similarityReport: JSON.stringify(similarity.matches),
        similarityCheckedAt: new Date(),
        funders: funders?.length ? JSON.stringify(funders) : null,
        apcWaiverRequested: apcWaiverRequested ?? false,
        apcWaiverReason: apcWaiverRequested ? apcWaiverReason || null : null,
        apcWaiverStatus: apcWaiverRequested ? "REQUESTED" : "NONE",
        submittedAt: new Date(),
      },
    });

    // References, if provided — validated later by an editor
    const refLines = (references ?? []).map((r) => r.trim()).filter(Boolean);
    if (refLines.length) {
      await db.reference.createMany({
        data: refLines.map((rawText) => ({ articleId: article.id, rawText })),
      });
    }

    // Audit log
    await db.auditLog.create({
      data: {
        userId: session.userId,
        action: "SUBMIT",
        entityType: "ARTICLE",
        entityId: article.id,
        articleId: article.id,
        metadata: JSON.stringify({ title, discipline, doi: draftDoi, plagiarismScore }),
      },
    });

    // Notify all editors
    const editors = await db.user.findMany({
      where: { role: { in: ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"] } },
    });
    await db.notification.createMany({
      data: editors.map((e) => ({
        userId: e.id,
        type: "INFO",
        title: "New Submission",
        message: `New ${discipline} manuscript submitted: "${title}" (DOI ${draftDoi}). Plagiarism score: ${plagiarismScore}%.`,
        articleId: article.id,
      })),
    });

    // --- PREMIUM: Fire async triage + indexing + WS notification ---
    // Run in background (non-blocking) so the submission response is immediate.
    Promise.all([
      // 1. LLM editorial triage
      import("@/lib/triage").then(({ runEditorialTriage }) =>
        runEditorialTriage(article.id).catch(() => {})
      ),
      // 2. Semantic embedding indexing
      import("@/lib/embeddings").then(({ indexArticle }) =>
        indexArticle(article.id).catch(() => {})
      ),
      // 3. WebSocket broadcast to editor dashboards
      import("@/lib/ws-client").then(({ emitToEditors }) =>
        emitToEditors("submission:new", {
          articleId: article.id,
          title: article.title,
          discipline: article.discipline,
          doi: article.doi,
          plagiarismScore,
        }).catch(() => {})
      ),
    ]).catch(() => {});

    return NextResponse.json({
      article: {
        id: article.id,
        doi: article.doi,
        doiStatus: article.doiStatus,
        status: article.status,
        plagiarismScore: article.plagiarismScore,
      },
    });
  } catch (e) {
    console.error("[submit]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
