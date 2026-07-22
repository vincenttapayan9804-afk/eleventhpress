import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { PRIVILEGED_ROLES_LIST } from "@/lib/roles";
import { withRlsContext } from "@/lib/db-rls";

/**
 * GET /api/crossref-log
 * Returns recent DOI / Crossref / indexing events from the audit log,
 * simulating the "Indexing & Discovery Service" control panel. Only ever
 * called from the dashboard's Indexing tab (EDITOR/ASSOCIATE_EDITOR/
 * SUPER_ADMIN only, per dashboard-view.tsx's NAV_ITEMS) — this route
 * itself had no matching server-side check, so it was reachable
 * unauthenticated by anyone who knew the URL. Closing that gap here.
 */
export async function GET(req: NextRequest) {
  const auth = requireRole(req.headers, PRIVILEGED_ROLES_LIST);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const logs = await withRlsContext(auth.session, (tx) =>
    tx.auditLog.findMany({
      where: {
        action: { in: ["DOI_MINT", "DOI_PUBLISH", "PUBLISH"] },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        user: { select: { fullName: true, role: true } },
        article: { select: { id: true, title: true, doi: true, status: true, discipline: true } },
      },
    })
  );

  const published = await db.article.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, doi: true, title: true, publishedAt: true, discipline: true },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      createdAt: l.createdAt,
      user: l.user,
      article: l.article,
      metadata: l.metadata ? JSON.parse(l.metadata) : null,
    })),
    published,
  });
}
