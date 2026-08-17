import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenantScope } from "@/lib/tenant-auth";
import { TENANT_SCOPED_ADMIN_ROLES } from "@/lib/roles";
import { removeDomainFromVercelProject } from "@/lib/vercel-domains";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; domainId: string }> }) {
  const { id, domainId } = await params;
  const auth = requireTenantScope(req.headers, id, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const domain = await db.tenantDomain.findUnique({ where: { id: domainId } });
  if (!domain || domain.tenantId !== id) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }
  if (domain.isPrimary) {
    return NextResponse.json({ error: "Cannot remove a tenant's primary domain" }, { status: 400 });
  }

  if (domain.vercelAdded) {
    const result = await removeDomainFromVercelProject(domain.hostname);
    if (!result.ok && !result.skipped) {
      return NextResponse.json({ error: `Failed to remove from Vercel: ${result.error}` }, { status: 502 });
    }
  }

  await db.tenantDomain.delete({ where: { id: domainId } });
  return NextResponse.json({ ok: true });
}
