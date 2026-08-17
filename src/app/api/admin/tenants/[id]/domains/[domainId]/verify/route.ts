import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { verifyDomainTxtRecord } from "@/lib/domain-verify";
import { addDomainToVercelProject } from "@/lib/vercel-domains";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; domainId: string }> }) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id, domainId } = await params;
  const domain = await db.tenantDomain.findUnique({ where: { id: domainId } });
  if (!domain || domain.tenantId !== id) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }
  if (domain.verified) {
    return NextResponse.json({ error: "Domain is already verified" }, { status: 400 });
  }
  if (!domain.verificationToken) {
    return NextResponse.json({ error: "This domain has no verification token to check" }, { status: 400 });
  }

  const dnsResult = await verifyDomainTxtRecord(domain.hostname, domain.verificationToken);
  if (!dnsResult.verified) {
    return NextResponse.json({ verified: false, error: dnsResult.error }, { status: 400 });
  }

  const vercelResult = await addDomainToVercelProject(domain.hostname);

  const updated = await db.tenantDomain.update({
    where: { id: domainId },
    data: { verified: true, verifiedAt: new Date(), vercelAdded: vercelResult.ok },
  });

  return NextResponse.json({
    verified: true,
    domain: {
      id: updated.id,
      hostname: updated.hostname,
      verified: updated.verified,
      vercelAdded: updated.vercelAdded,
    },
    vercel: vercelResult.ok
      ? { ok: true }
      : { ok: false, skipped: vercelResult.skipped ?? false, note: vercelResult.error },
  });
}
