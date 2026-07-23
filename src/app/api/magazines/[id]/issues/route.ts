import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { PRIVILEGED_ROLES_LIST as PRIVILEGED_ROLES } from "@/lib/roles";

/**
 * POST /api/magazines/[id]/issues { volume, issueNumber, year, title?, theme?, coverImageKey? }
 * Creates a new DRAFT issue under this magazine. Editorial-only — issues
 * are assembled by staff, not submitted.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, PRIVILEGED_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  const { id: magazineId } = await params;
  const magazine = await db.magazine.findUnique({ where: { id: magazineId } });
  if (!magazine) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as {
    volume?: number;
    issueNumber?: number;
    year?: number;
    title?: string;
    theme?: string;
    coverImageKey?: string;
  };
  if (body.volume == null || body.issueNumber == null || body.year == null) {
    return NextResponse.json({ error: "volume, issueNumber, and year are required" }, { status: 400 });
  }

  const dupe = await db.magazineIssue.findUnique({
    where: { magazineId_volume_issueNumber: { magazineId, volume: body.volume, issueNumber: body.issueNumber } },
  });
  if (dupe) return NextResponse.json({ error: "An issue with that volume/number already exists for this magazine" }, { status: 409 });

  const issue = await db.magazineIssue.create({
    data: {
      magazineId,
      volume: body.volume,
      issueNumber: body.issueNumber,
      year: body.year,
      title: body.title,
      theme: body.theme,
      coverImageKey: body.coverImageKey,
      createdById: session.userId,
      status: "DRAFT",
    },
  });

  return NextResponse.json({ issue });
}
