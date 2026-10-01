import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { removeDomainFromVercelProject } from "@/lib/vercel-domains";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; domainId: string }> }) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id, domainId } = await params;
  const domain = await db.authorDomain.findUnique({ where: { id: domainId } });
  if (!domain || domain.userId !== id) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  if (domain.vercelAdded) {
    const result = await removeDomainFromVercelProject(domain.hostname);
    if (!result.ok && !result.skipped) {
      return NextResponse.json({ error: `Failed to remove from Vercel: ${result.error}` }, { status: 502 });
    }
  }

  await db.authorDomain.delete({ where: { id: domainId } });
  return NextResponse.json({ ok: true });
}
