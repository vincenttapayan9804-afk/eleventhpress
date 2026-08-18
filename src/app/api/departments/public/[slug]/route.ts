import { NextRequest, NextResponse } from "next/server";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { withTenantRlsContext } from "@/lib/db-rls";

/**
 * GET /api/departments/public/[slug]
 * EP University OS Phase 2 — a department's public landing page data:
 * name, optional head, and its member roster. Scoped to the current
 * request's tenant (a department slug is only unique per-tenant, per the
 * schema's @@unique([tenantId, slug])), so a slug from one tenant can never
 * resolve a department belonging to another.
 *
 * Member fields exposed here are exactly the same public-profile subset
 * already surfaced by GET /api/authors — never the private login `email`,
 * only the opt-in `contactEmail`.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await resolveTenantFromHeaders(req.headers);
  if (!tenant) return NextResponse.json({ error: "Department not found" }, { status: 404 });

  const department = await withTenantRlsContext(tenant.id, (tx) =>
    tx.department.findUnique({
      where: { tenantId_slug: { tenantId: tenant.id, slug } },
      select: {
        id: true,
        name: true,
        slug: true,
        head: { select: { id: true, fullName: true, avatarUrl: true, profession: true } },
        members: {
          orderBy: { fullName: "asc" },
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            profession: true,
            bio: true,
            academicStatus: true,
            website: true,
            contactEmail: true,
            orcid: true,
          },
        },
      },
    })
  );

  if (!department) return NextResponse.json({ error: "Department not found" }, { status: 404 });

  return NextResponse.json({ department });
}
