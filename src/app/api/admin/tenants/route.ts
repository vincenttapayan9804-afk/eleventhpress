import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { getOrCreateTenantJournal } from "@/lib/tenant";

/**
 * GET/POST /api/admin/tenants
 * SUPER_ADMIN only — platform-level tenant management (Whitelabel Phase 3).
 * There is no tenant-scoped admin role yet (that's Phase 4), so tenant
 * creation/listing is platform-super-admin-only by design.
 */

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const CreateTenantSchema = z.object({
  slug: z.string().trim().toLowerCase().min(2).max(63).regex(SLUG_RE, "Lowercase letters, numbers, and hyphens only; can't start or end with a hyphen"),
  name: z.string().trim().min(1).max(200),
});

export async function GET(req: NextRequest) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenants = await db.tenant.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { domains: true, users: true } },
      domains: { orderBy: { createdAt: "asc" } },
    },
  });

  return NextResponse.json({
    tenants: tenants.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      status: t.status,
      isPlatform: t.isPlatform,
      createdAt: t.createdAt,
      domainCount: t._count.domains,
      userCount: t._count.users,
      domains: t.domains.map((d) => ({
        id: d.id,
        hostname: d.hostname,
        isPrimary: d.isPrimary,
        verified: d.verified,
        vercelAdded: d.vercelAdded,
        verificationToken: d.verified ? null : d.verificationToken,
        createdAt: d.createdAt,
      })),
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseBody(req, CreateTenantSchema);
  if (!parsed.ok) return parsed.response;

  const existing = await db.tenant.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) {
    return NextResponse.json({ error: `Slug "${parsed.data.slug}" is already in use` }, { status: 409 });
  }

  const tenant = await db.tenant.create({
    data: { slug: parsed.data.slug, name: parsed.data.name, status: "ACTIVE" },
  });

  // Whitelabel Phase 5 — every tenant needs its own Journal to submit
  // manuscripts into; see getOrCreateTenantJournal's doc comment.
  await getOrCreateTenantJournal(tenant);

  // Free subdomain under the configured root domain, if one is set — no DNS
  // challenge needed since we already control the whole zone.
  const rootDomain = process.env.TENANT_ROOT_DOMAIN;
  let subdomain: { hostname: string } | null = null;
  if (rootDomain) {
    const hostname = `${tenant.slug}.${rootDomain}`;
    const domain = await db.tenantDomain.create({
      data: { tenantId: tenant.id, hostname, isPrimary: true, verified: true, verifiedAt: new Date() },
    });
    subdomain = { hostname: domain.hostname };
  }

  return NextResponse.json(
    {
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, status: tenant.status, isPlatform: tenant.isPlatform },
      subdomain,
    },
    { status: 201 }
  );
}
