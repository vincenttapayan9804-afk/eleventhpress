import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { generateCounterApiKey } from "@/lib/institutions";

/**
 * POST /api/institutions/[id]/counter-key
 * Regenerates an institution's SUSHI API key (src/lib/institutions.ts,
 * verifySushiApiKey()). SUPER_ADMIN only — this is a credential rotation,
 * the same sensitivity bar as the key's read access in
 * GET /api/institutions/list.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Super admin required" }, { status: 403 });
  }

  const { id } = await params;
  const institution = await db.institution.findUnique({ where: { id } });
  if (!institution) {
    return NextResponse.json({ error: "Institution not found" }, { status: 404 });
  }

  const counterApiKey = generateCounterApiKey();
  await db.institution.update({ where: { id }, data: { counterApiKey } });

  return NextResponse.json({ counterApiKey });
}
