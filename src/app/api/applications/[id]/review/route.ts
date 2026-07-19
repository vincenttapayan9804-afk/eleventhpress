import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { EXPERT_APPLICATION_TIERS } from "@/lib/roles";
import { renderAndPersistCertificate } from "@/lib/certificates-server";

/**
 * EXPERT_CONTRIBUTOR/EXPERT_COUNCIL_MEMBER are RoleApplication.requestedRole
 * values, not real User.role values (see src/lib/roles.ts) — approving one
 * promotes User.role to the single "EXPERT" value and records which
 * Prestige Council tier was granted on User.expertTier, rather than writing
 * the requestedRole string straight onto role like every other application
 * type does.
 */
function resolveApprovedRole(requestedRole: string): { role: string; expertTier: string | null } {
  if (EXPERT_APPLICATION_TIERS.includes(requestedRole)) {
    const tier = requestedRole === "EXPERT_COUNCIL_MEMBER" ? "COUNCIL_MEMBER" : "CONTRIBUTOR";
    return { role: "EXPERT", expertTier: tier };
  }
  return { role: requestedRole, expertTier: null };
}

const APPLICATION_ROLE_LABELS: Record<string, string> = {
  REVIEWER: "peer reviewer",
  EDITOR: "editor",
  EXPERT_CONTRIBUTOR: "Council of Experts Contributor",
  EXPERT_COUNCIL_MEMBER: "Council of Experts Council Member",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { action, note } = body as { action?: string; note?: string };

  if (!action || !["APPROVE", "REJECT"].includes(action)) {
    return NextResponse.json({ error: "action must be APPROVE or REJECT" }, { status: 400 });
  }

  const application = await db.roleApplication.findUnique({ where: { id } });
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (!["PENDING", "UNDER_REVIEW"].includes(application.status)) {
    return NextResponse.json({ error: "Application already resolved" }, { status: 409 });
  }

  const newStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";

  await db.roleApplication.update({
    where: { id },
    data: {
      status: newStatus,
      reviewedBy: session.userId,
      reviewedAt: new Date(),
      reviewNote: note || null,
    },
  });

  if (action === "APPROVE") {
    const { role, expertTier } = resolveApprovedRole(application.requestedRole);
    await db.user.update({
      where: { id: application.userId },
      data: { role, expertTier },
    });

    // Seal of Quality — issued automatically the moment a Prestige
    // Application is approved, since that approval *is* the vetting event
    // the Seal represents (never self-claimed). Best-effort: a storage
    // hiccup here shouldn't block the approval itself; the user can
    // generate it manually from the Certificates tab if this fails.
    if (role === "EXPERT") {
      renderAndPersistCertificate(application.userId, "MEMBERSHIP", "EXPERT", null).catch((e) =>
        console.error("[applications/review] Seal of Quality issuance failed", e)
      );
    }
  }

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: action === "APPROVE" ? "ROLE_APPLICATION_APPROVED" : "ROLE_APPLICATION_REJECTED",
      entityType: "USER",
      entityId: application.userId,
      metadata: JSON.stringify({ applicationId: id, requestedRole: application.requestedRole, note }),
    },
  });

  const roleLabel = APPLICATION_ROLE_LABELS[application.requestedRole] || application.requestedRole.toLowerCase();

  await db.notification.create({
    data: {
      userId: application.userId,
      type: action === "APPROVE" ? "SUCCESS" : "INFO",
      title: action === "APPROVE"
        ? `Your ${roleLabel} application has been approved`
        : `Your ${roleLabel} application was not approved`,
      message: action === "APPROVE"
        ? `Congratulations! You now have ${roleLabel} access. Please sign out and sign back in to see your new dashboard.`
        : note
          ? `Reason: ${note}. You may reapply with updated qualifications.`
          : "You may reapply with updated qualifications.",
    },
  });

  return NextResponse.json({ ok: true, status: newStatus });
}
