import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireTenantScope } from "@/lib/tenant-auth";
import { TENANT_SCOPED_ADMIN_ROLES } from "@/lib/roles";
import { parseBody } from "@/lib/validate";
import { withRlsContext } from "@/lib/db-rls";

/**
 * GET/POST /api/admin/funders
 * EP University OS Phase 4 — a tenant's structured funder registry, same
 * admin posture and tenant-confinement shape as /api/admin/departments.
 * Distinct from Article.funders' free-text JSON captured at submission for
 * Crossref FundRef deposit — this registry is a curated list a grants
 * office builds up over time, referenced by Grant.funderId.
 */

const CreateFunderSchema = z.object({
  tenantId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(200),
  externalId: z.string().trim().max(200).optional(),
  country: z.string().trim().max(100).optional(),
  website: z.string().trim().url().max(500).optional(),
});

export async function GET(req: NextRequest) {
  const auth = requireRole(req.headers, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  const requestedTenantId = req.nextUrl.searchParams.get("tenantId") ?? undefined;
  let tenantId: string | undefined;
  if (session.role === "TENANT_ADMIN") {
    tenantId = session.tenantId ?? undefined;
  } else {
    tenantId = requestedTenantId;
  }

  const funders = await withRlsContext(session, (tx) =>
    tx.funder.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { name: "asc" },
      include: { _count: { select: { grants: true } } },
    })
  );

  return NextResponse.json({
    funders: funders.map((f) => ({
      id: f.id,
      tenantId: f.tenantId,
      name: f.name,
      externalId: f.externalId,
      country: f.country,
      website: f.website,
      grantCount: f._count.grants,
      createdAt: f.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req.headers, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  const parsed = await parseBody(req, CreateFunderSchema);
  if (!parsed.ok) return parsed.response;
  const { name, externalId, country, website } = parsed.data;

  let tenantId: string;
  if (session.role === "TENANT_ADMIN") {
    if (parsed.data.tenantId && parsed.data.tenantId !== session.tenantId) {
      return NextResponse.json({ error: "Forbidden — not an admin of this tenant" }, { status: 403 });
    }
    if (!session.tenantId) {
      return NextResponse.json({ error: "Your session has no tenant context" }, { status: 400 });
    }
    tenantId = session.tenantId;
  } else {
    if (!parsed.data.tenantId) {
      return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
    }
    tenantId = parsed.data.tenantId;
  }

  const tenantScope = requireTenantScope(req.headers, tenantId, TENANT_SCOPED_ADMIN_ROLES);
  if (!tenantScope.ok) return NextResponse.json({ error: tenantScope.error }, { status: tenantScope.status });

  const existing = await db.funder.findUnique({ where: { tenantId_name: { tenantId, name } } });
  if (existing) {
    return NextResponse.json({ error: `A funder named "${name}" already exists for this tenant` }, { status: 409 });
  }

  const funder = await db.funder.create({
    data: {
      tenantId,
      name,
      externalId: externalId ?? null,
      country: country ?? null,
      website: website ?? null,
    },
  });

  return NextResponse.json({ funder }, { status: 201 });
}
