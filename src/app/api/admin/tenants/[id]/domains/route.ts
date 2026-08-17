import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenantScope } from "@/lib/tenant-auth";
import { TENANT_SCOPED_ADMIN_ROLES } from "@/lib/roles";
import { parseBody } from "@/lib/validate";

// Deliberately conservative — a bare, valid DNS hostname only (no scheme,
// no path, no port, no wildcard). This value is later interpolated into a
// DNS TXT lookup name (`_ep-verify.<hostname>`) and a Vercel API path
// segment, so it must be a well-formed hostname and nothing else.
const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
const CreateDomainSchema = z.object({
  hostname: z.string().trim().toLowerCase().max(253).regex(HOSTNAME_RE, "Must be a valid hostname, e.g. journals.example.edu"),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireTenantScope(req.headers, id, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenant = await db.tenant.findUnique({ where: { id } });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const domains = await db.tenantDomain.findMany({ where: { tenantId: id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({
    domains: domains.map((d) => ({
      id: d.id,
      hostname: d.hostname,
      isPrimary: d.isPrimary,
      verified: d.verified,
      vercelAdded: d.vercelAdded,
      verificationToken: d.verified ? null : d.verificationToken,
      createdAt: d.createdAt,
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireTenantScope(req.headers, id, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenant = await db.tenant.findUnique({ where: { id } });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const parsed = await parseBody(req, CreateDomainSchema);
  if (!parsed.ok) return parsed.response;

  const existing = await db.tenantDomain.findUnique({ where: { hostname: parsed.data.hostname } });
  if (existing) {
    return NextResponse.json({ error: `"${parsed.data.hostname}" is already registered` }, { status: 409 });
  }

  const verificationToken = crypto.randomBytes(16).toString("hex");
  const domain = await db.tenantDomain.create({
    data: { tenantId: id, hostname: parsed.data.hostname, verified: false, verificationToken },
  });

  return NextResponse.json(
    {
      domain: {
        id: domain.id,
        hostname: domain.hostname,
        verified: domain.verified,
        vercelAdded: domain.vercelAdded,
        verificationToken,
      },
      dnsInstructions: {
        txt: { name: `_ep-verify.${domain.hostname}`, value: verificationToken },
        cname: { name: domain.hostname, value: "cname.vercel-dns.com" },
        note: "Add the TXT record to prove ownership, then click Verify. Also point the domain at Vercel (CNAME to cname.vercel-dns.com, or an A record to 76.76.21.21 for an apex domain) so it actually serves traffic once verified.",
      },
    },
    { status: 201 }
  );
}
