import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { getPlatform, buildShareKit, buildSubmissionPackage, PLATFORMS } from "@/lib/distribution";

const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "EDITOR", "ASSOCIATE_EDITOR"]);

async function canManage(articleCorrespondingAuthorId: string | null, session: { userId: string; role: string }) {
  if (PRIVILEGED_ROLES.has(session.role)) return true;
  return !!articleCorrespondingAuthorId && session.userId === articleCorrespondingAuthorId;
}

/**
 * GET /api/distribution?articleId=X
 * Lists every Distribution row for the article, including platforms that
 * have never been generated (returned as NOT_STARTED stubs) so the
 * dashboard can render a full status grid in one call.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const articleId = new URL(req.url).searchParams.get("articleId");
  if (!articleId) return NextResponse.json({ error: "articleId is required" }, { status: 400 });

  const article = await db.article.findUnique({ where: { id: articleId } });
  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canManage(article.correspondingAuthorId, session))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (article.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Distribution is only available for published articles" }, { status: 400 });
  }

  const rows = await db.distribution.findMany({ where: { articleId } });
  const byPlatform = new Map(rows.map((r) => [r.platform, r]));

  const items = PLATFORMS.map((p) => {
    const existing = byPlatform.get(p.id);
    return existing || {
      id: null,
      articleId,
      platform: p.id,
      tier: p.tier,
      status: "NOT_STARTED",
      packageContent: null,
      externalUrl: null,
      submittedAt: null,
    };
  });

  return NextResponse.json({ items });
}

/**
 * POST /api/distribution { articleId, platform, consent? }
 * Generates (or regenerates) the share kit / submission package for a
 * platform. Upserts on the (articleId, platform) unique constraint so
 * re-clicking "Generate" just refreshes the content rather than creating
 * duplicate rows.
 *
 * Tier B platforms (arXiv/SSRN) require `consent: true` on this call (or an
 * already-recorded consent from a prior call) before a package is
 * generated — see src/lib/distribution.ts's module doc for why this can't
 * be skipped even for a re-generate.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { articleId, platform, consent } = (await req.json()) as { articleId?: string; platform?: string; consent?: boolean };
  if (!articleId || !platform) {
    return NextResponse.json({ error: "articleId and platform are required" }, { status: 400 });
  }
  const platformDef = getPlatform(platform);
  if (!platformDef) return NextResponse.json({ error: `Unknown platform: ${platform}` }, { status: 400 });

  const article = await db.article.findUnique({ where: { id: articleId }, include: { journal: true } });
  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canManage(article.correspondingAuthorId, session))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (article.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Distribution is only available for published articles" }, { status: 400 });
  }

  let hasConsent = false;
  if (platformDef.tier === "B") {
    const existing = await db.distribution.findUnique({ where: { articleId_platform: { articleId, platform } } });
    hasConsent = !!consent || !!existing?.authorConsent;
    if (!hasConsent) {
      return NextResponse.json({ error: "Author consent is required before generating a submission package for this platform" }, { status: 400 });
    }
  }

  const articleForKit = {
    id: article.id,
    title: article.title,
    abstract: article.abstract,
    authors: article.authors,
    discipline: article.discipline,
    keywords: article.keywords,
    doi: article.doi,
    laySummary: article.laySummary,
    journalName: article.journal?.name,
  };

  const kit = platformDef.tier === "B" ? buildSubmissionPackage(articleForKit, platform) : buildShareKit(articleForKit);

  const row = await db.distribution.upsert({
    where: { articleId_platform: { articleId, platform } },
    create: {
      articleId,
      platform,
      tier: platformDef.tier,
      status: "PACKAGE_READY",
      packageContent: JSON.stringify(kit),
      authorConsent: hasConsent,
      consentedAt: hasConsent ? new Date() : null,
    },
    update: {
      status: "PACKAGE_READY",
      packageContent: JSON.stringify(kit),
      ...(hasConsent ? { authorConsent: true, consentedAt: new Date() } : {}),
    },
  });

  return NextResponse.json({ item: row, kit });
}
