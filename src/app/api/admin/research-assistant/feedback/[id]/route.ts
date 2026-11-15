import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assistantAdminScope, tenantRowFilter } from "@/lib/research-assistant-admin";

/**
 * PATCH /api/admin/research-assistant/feedback/[id] {status: "OPEN"|"RESOLVED",
 * resolution?: string} — an editor resolves (or reopens) a reader's report,
 * with an optional note on what was done.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await assistantAdminScope(req.headers, "all");
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });
  let body: { status?: unknown; resolution?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body.status !== "OPEN" && body.status !== "RESOLVED") return NextResponse.json({ error: "status must be OPEN or RESOLVED" }, { status: 400 });
  const row = await db.researchFeedback.findFirst({ where: { id, ...tenantRowFilter(scope) } as any, select: { id: true } });
  if (!row) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  const resolution = typeof body.resolution === "string" ? body.resolution.trim().slice(0, 1000) || null : null;
  const updated = await db.researchFeedback.update({
    where: { id },
    data:
      body.status === "RESOLVED"
        ? { status: "RESOLVED", resolution, resolvedAt: new Date(), resolvedBy: scope.session.userId }
        : { status: "OPEN", resolution: null, resolvedAt: null, resolvedBy: null },
    select: { id: true, status: true, resolution: true, resolvedAt: true },
  });
  return NextResponse.json({ item: updated });
}
