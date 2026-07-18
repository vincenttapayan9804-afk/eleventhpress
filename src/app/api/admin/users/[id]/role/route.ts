import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { ALL_ROLES as VALID_ROLES } from "@/lib/roles";

/**
 * POST /api/admin/users/[id]/role
 * The only way an account gets a privileged role (REVIEWER, EDITOR,
 * ASSOCIATE_EDITOR, SUPER_ADMIN) — self-registration can only ever create
 * READER/AUTHOR accounts (see /api/auth/register). SUPER_ADMIN only.
 * Body: { role: "READER" | "AUTHOR" | "REVIEWER" | "ASSOCIATE_EDITOR" | "EDITOR" | "SUPER_ADMIN" }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { session } = auth;

  const { id } = await params;
  const { role } = (await req.json()) as { role?: string };
  if (!role || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` }, { status: 400 });
  }

  const target = await db.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
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
