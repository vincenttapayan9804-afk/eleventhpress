import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { ALL_ROLES as VALID_ROLES } from "@/lib/roles";
import { parseBody } from "@/lib/validate";

const RoleChangeSchema = z.object({ role: z.string().min(1).max(50) });

// Platform-level roles a TENANT_ADMIN must never grant (or hold onto by
// changing someone else into one) — only SUPER_ADMIN can create more
// SUPER_ADMINs or TENANT_ADMINs.
const PLATFORM_ONLY_ROLES = new Set(["SUPER_ADMIN", "TENANT_ADMIN"]);

/**
 * POST /api/admin/users/[id]/role
 * The only way an account gets a privileged role (REVIEWER, EDITOR,
 * ASSOCIATE_EDITOR, SUPER_ADMIN, TENANT_ADMIN) — self-registration can only
 * ever create READER/AUTHOR accounts (see /api/auth/register).
 * SUPER_ADMIN may change any account to any role. TENANT_ADMIN (Whitelabel
 * Phase 4) may only change accounts within their own tenant, and only to a
 * non-platform role (REVIEWER/EDITOR/ASSOCIATE_EDITOR/AUTHOR/READER) —
 * granting SUPER_ADMIN or TENANT_ADMIN itself stays a platform-only action.
 * Body: { role: "READER" | "AUTHOR" | "REVIEWER" | "ASSOCIATE_EDITOR" | "EDITOR" | "SUPER_ADMIN" | "TENANT_ADMIN" }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN", "TENANT_ADMIN"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { session } = auth;

  const { id } = await params;
  const parsed = await parseBody(req, RoleChangeSchema);
  if (!parsed.ok) return parsed.response;
  const { role } = parsed.data;
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` }, { status: 400 });
  }

  const target = await db.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (session.role === "TENANT_ADMIN") {
    if (target.tenantId !== session.tenantId) {
      return NextResponse.json({ error: "Forbidden — that account isn't in your tenant" }, { status: 403 });
    }
    if (PLATFORM_ONLY_ROLES.has(role) || PLATFORM_ONLY_ROLES.has(target.role)) {
      return NextResponse.json({ error: "Only a platform SUPER_ADMIN can grant or change a platform-level role" }, { status: 403 });
    }
  }

  const updated = await db.user.update({
    where: { id },
    data: { role },
  });

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "ROLE_CHANGE",
      entityType: "USER",
      entityId: id,
      metadata: JSON.stringify({ from: target.role, to: role, targetEmail: target.email }),
    },
  });

  return NextResponse.json({
    user: { id: updated.id, email: updated.email, fullName: updated.fullName, role: updated.role },
  });
}
