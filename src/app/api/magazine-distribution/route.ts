import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getMagazinePlatform, buildMagazinePackage, MAGAZINE_PLATFORMS } from "@/lib/magazine-distribution";
import { PRIVILEGED_ROLES_LIST as PRIVILEGED_ROLES } from "@/lib/roles";

/**
 * GET /api/magazine-distribution?issueId=X
 * Lists every MagazineDistribution row for the issue, including platforms
 * that have never been generated (returned as NOT_STARTED stubs), same
 * shape as GET /api/book-distribution. Editorial-only.
 */
export async function GET(req: NextRequest) {
  const auth = requireRole(req.headers, PRIVILEGED_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const issueId = new URL(req.url).searchParams.get("issueId");
  if (!issueId) return NextResponse.json({ error: "issueId is required" }, { status: 400 });

  const issue = await db.magazineIssue.findUnique({ where: { id: issueId } });
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (issue.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Distribution is only available for published issues" }, { status: 400 });
  }

  const rows = await db.magazineDistribution.findMany({ where: { issueId } });
  const byPlatform = new Map(rows.map((r) => [r.platform, r]));

  const items = MAGAZINE_PLATFORMS.map((p) => {
    const existing = byPlatform.get(p.id);
    return existing || {
      id: null,
      issueId,
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
 * POST /api/magazine-distribution { issueId, platform, consent? }
 * Generates (or regenerates) the metadata package for a platform. Upserts
 * on the (issueId, platform) unique constraint, same as
 * POST /api/book-distribution. Requires the issue to be PUBLISHED with a
 * finished EPUB present. Tier B platforms (Issuu/PressReader) additionally
 * require `consent: true` (or an already-recorded consent).
 */
export async function POST(req: NextRequest) {
  const auth = requireRole(req.headers, PRIVILEGED_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { issueId, platform, consent } = (await req.json()) as { issueId?: string; platform?: string; consent?: boolean };
  if (!issueId || !platform) {
    return NextResponse.json({ error: "issueId and platform are required" }, { status: 400 });
  }
  const platformDef = getMagazinePlatform(platform);
  if (!platformDef) return NextResponse.json({ error: `Unknown platform: ${platform}` }, { status: 400 });

  const issue = await db.magazineIssue.findUnique({ where: { id: issueId }, include: { magazine: true } });
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (issue.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Distribution is only available for published issues" }, { status: 400 });
  }
  if (!issue.epubKey) {
    return NextResponse.json({ error: "This issue has no finished EPUB yet — production must complete before it can be distributed" }, { status: 400 });
  }

  let hasConsent = false;
  if (platformDef.tier === "B") {
    const existing = await db.magazineDistribution.findUnique({ where: { issueId_platform: { issueId, platform } } });
    hasConsent = !!consent || !!existing?.authorConsent;
    if (!hasConsent) {
      return NextResponse.json({ error: "Consent is required before generating a submission package for this platform" }, { status: 400 });
    }
  }

  const pkg = buildMagazinePackage({
    id: issue.id,
    title: issue.title,
    volume: issue.volume,
    issueNumber: issue.issueNumber,
    year: issue.year,
    theme: issue.theme,
    magazineName: issue.magazine.name,
    magazineDescription: issue.magazine.description,
  });

  const row = await db.magazineDistribution.upsert({
    where: { issueId_platform: { issueId, platform } },
    create: {
      issueId,
      platform,
      tier: platformDef.tier,
      status: "PACKAGE_READY",
      packageContent: JSON.stringify(pkg),
      authorConsent: hasConsent,
      consentedAt: hasConsent ? new Date() : null,
    },
    update: {
      status: "PACKAGE_READY",
      packageContent: JSON.stringify(pkg),
      ...(hasConsent ? { authorConsent: true, consentedAt: new Date() } : {}),
    },
  });

  return NextResponse.json({ item: row, package: pkg });
}
