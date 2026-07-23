import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { presignGet } from "@/lib/storage";
import { getSessionFromHeaders, requireRole } from "@/lib/auth";
import { PRIVILEGED_ROLES_LIST as PRIVILEGED_ROLES } from "@/lib/roles";

/**
 * GET /api/magazine-issues/[id]
 * Public callers may only fetch a PUBLISHED issue; editorial staff can
 * fetch any status (management dashboard). Includes pieces in reader order.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const issue = await db.magazineIssue.findUnique({
    where: { id },
    include: { magazine: true, pieces: { orderBy: { order: "asc" } } },
  });
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = getSessionFromHeaders(req.headers);
  const isPrivileged = !!session && PRIVILEGED_ROLES.includes(session.role);
  if (issue.status !== "PUBLISHED" && !isPrivileged) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const heroUrls = await Promise.all(
    issue.pieces.map(async (p) => (p.heroImageKey ? await presignGet(p.heroImageKey) : null))
  );

  return NextResponse.json({
    issue: {
      ...issue,
      coverImageUrl: issue.coverImageKey ? await presignGet(issue.coverImageKey) : null,
      epubUrl: issue.epubKey ? await presignGet(issue.epubKey, `issue-${issue.volume}-${issue.issueNumber}.epub`) : null,
      pdfUrl: issue.pdfKey ? await presignGet(issue.pdfKey, `issue-${issue.volume}-${issue.issueNumber}.pdf`) : null,
      pieces: issue.pieces.map((p, i) => ({ ...p, heroImageUrl: heroUrls[i] })),
    },
  });
}

/** PATCH /api/magazine-issues/[id] { title?, theme?, coverImageKey?, volume?, issueNumber?, year? } — editorial-only, DRAFT issues only. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, PRIVILEGED_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const existing = await db.magazineIssue.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.status !== "DRAFT") {
    return NextResponse.json({ error: "Only DRAFT issues can be edited — an issue in production or already published is locked" }, { status: 400 });
  }

  const body = (await req.json()) as {
    title?: string;
    theme?: string;
    coverImageKey?: string;
    volume?: number;
    issueNumber?: number;
    year?: number;
  };

  const issue = await db.magazineIssue.update({
    where: { id },
    data: {
      title: body.title ?? existing.title,
      theme: body.theme ?? existing.theme,
      coverImageKey: body.coverImageKey ?? existing.coverImageKey,
      volume: body.volume ?? existing.volume,
      issueNumber: body.issueNumber ?? existing.issueNumber,
      year: body.year ?? existing.year,
    },
  });

  return NextResponse.json({ issue });
}
