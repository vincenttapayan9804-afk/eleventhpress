import { NextRequest, NextResponse } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { withTenantRlsContext } from "@/lib/db-rls";

/**
 * GET /api/grants
 * EP University OS Phase 4 — read-only self-service view: any authenticated
 * session sees only the grants where they're recorded as principal
 * investigator, mirroring how GET /api/ethics-submissions scopes to
 * submittedByUserId: session.userId. Grant creation/editing stays an admin
 * action (/api/admin/grants) — unlike ethics submissions, a researcher
 * doesn't self-file a grant record, a grants office does.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const grants = await withTenantRlsContext(session.tenantId ?? null, (tx) =>
    tx.grant.findMany({
      where: { principalInvestigatorUserId: session.userId },
      orderBy: { createdAt: "desc" },
      include: {
        funder: { select: { id: true, name: true } },
        department: { select: { id: true, name: true, slug: true } },
        article: { select: { id: true, title: true } },
      },
    })
  );

  return NextResponse.json({ grants });
}
