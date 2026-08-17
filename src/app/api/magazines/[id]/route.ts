import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { presignGet } from "@/lib/storage";
import { getSessionFromHeaders, requireRole } from "@/lib/auth";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { withRlsContext, withTenantRlsContext } from "@/lib/db-rls";
import { PRIVILEGED_ROLES_LIST as PRIVILEGED_ROLES } from "@/lib/roles";

/**
 * GET /api/magazines/[id]
 * Public callers see PUBLISHED issues only; editorial staff (EDITOR/
 * ASSOCIATE_EDITOR/SUPER_ADMIN) additionally see DRAFT/IN_PRODUCTION issues
 * for the management dashboard.
 *
 * Whitelabel Phase 8 — scoped by the resolved tenant, same as the list
 * endpoint (GET /api/magazines): an id belonging to a different tenant now
 * 404s at the app layer, and the read runs inside withTenantRlsContext so
 * it's covered once RLS activation flips the runtime DB role.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await resolveTenantFromHeaders(req.headers);
  const tenantId = tenant?.id ?? null;
  const magazine = await withTenantRlsContext(tenantId, (tx) =>
    tx.magazine.findFirst({ where: { id, tenantId } })
  );
  if (!magazine) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = getSessionFromHeaders(req.headers);
  const canSeeAll = !!session && PRIVILEGED_ROLES.includes(session.role);

  const issues = await withTenantRlsContext(tenantId, (tx) =>
    tx.magazineIssue.findMany({
      where: canSeeAll ? { magazineId: id } : { magazineId: id, status: "PUBLISHED" },
      orderBy: [{ year: "desc" }, { volume: "desc" }, { issueNumber: "desc" }],
    })
  );

  const issuesWithUrls = await Promise.all(
    issues.map(async (i) => ({
      ...i,
      coverImageUrl: i.coverImageKey ? await presignGet(i.coverImageKey) : null,
      epubUrl: i.epubKey ? await presignGet(i.epubKey, `${magazine.name}-${i.volume}-${i.issueNumber}.epub`) : null,
      pdfUrl: i.pdfKey ? await presignGet(i.pdfKey, `${magazine.name}-${i.volume}-${i.issueNumber}.pdf`) : null,
    }))
  );

  return NextResponse.json({
    magazine: { ...magazine, coverImageUrl: magazine.coverImageKey ? await presignGet(magazine.coverImageKey) : null },
    issues: issuesWithUrls,
  });
}

/** PATCH /api/magazines/[id] { name?, description?, coverImageKey? } — editorial-only. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, PRIVILEGED_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const existing = await withRlsContext(auth.session, (tx) => tx.magazine.findUnique({ where: { id } }));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as { name?: string; description?: string; coverImageKey?: string };
  const magazine = await db.magazine.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      coverImageKey: body.coverImageKey ?? existing.coverImageKey,
    },
  });

  return NextResponse.json({ magazine });
}
