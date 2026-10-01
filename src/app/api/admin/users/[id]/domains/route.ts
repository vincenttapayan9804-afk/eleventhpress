import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { parseBody } from "@/lib/validate";

// Same conservative hostname shape as TenantDomain's (see that route's
// comment) — this value is interpolated into a DNS TXT lookup name and a
// Vercel API path segment, so it must be a well-formed hostname only.
const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
const CreateDomainSchema = z.object({
  hostname: z.string().trim().toLowerCase().max(253).regex(HOSTNAME_RE, "Must be a valid hostname, e.g. jane-doe.com"),
});

/**
 * GET/POST /api/admin/users/[id]/domains
 * A custom domain for one author's public profile — same verification and
 * Vercel-provisioning mechanics as TenantDomain (see
 * /api/admin/tenants/[id]/domains), scoped to a User instead. SUPER_ADMIN
 * only, same trust model as tenant domains: admin-provisioned rather than
 * self-serve, so claiming a hostname never becomes an unsupervised way to
 * consume the platform's Vercel domain quota. See the AuthorDomain model's
 * schema comment for what "verified" does and does not yet do.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const user = await db.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const domains = await db.authorDomain.findMany({ where: { userId: id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({
    domains: domains.map((d) => ({
      id: d.id,
      hostname: d.hostname,
      verified: d.verified,
      vercelAdded: d.vercelAdded,
      verificationToken: d.verified ? null : d.verificationToken,
      createdAt: d.createdAt,
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const user = await db.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const parsed = await parseBody(req, CreateDomainSchema);
  if (!parsed.ok) return parsed.response;

  const existing = await db.authorDomain.findUnique({ where: { hostname: parsed.data.hostname } });
  if (existing) {
    return NextResponse.json({ error: `"${parsed.data.hostname}" is already registered` }, { status: 409 });
  }

  const verificationToken = crypto.randomBytes(16).toString("hex");
  const domain = await db.authorDomain.create({
    data: { userId: id, hostname: parsed.data.hostname, verified: false, verificationToken },
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
        note: "Add the TXT record to prove ownership, then click Verify. Also point the domain at Vercel (CNAME to cname.vercel-dns.com, or an A record to 76.76.21.21 for an apex domain) so it's ready to serve traffic once routing support ships.",
      },
    },
    { status: 201 }
  );
}
