import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

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
    await db.user.update({
      where: { id: application.userId },
      data: { role: application.requestedRole },
    });
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

  await db.notification.create({
    data: {
      userId: application.userId,
      type: action === "APPROVE" ? "SUCCESS" : "INFO",
      title: action === "APPROVE"
        ? `Your ${application.requestedRole.toLowerCase()} application has been approved`
        : `Your ${application.requestedRole.toLowerCase()} application was not approved`,
      message: action === "APPROVE"
        ? `Congratulations! You now have ${application.requestedRole} access. Please sign out and sign back in to see your new dashboard.`
        : note
          ? `Reason: ${note}. You may reapply with updated qualifications.`
          : "You may reapply with updated qualifications.",
    },
  });

  return NextResponse.json({ ok: true, status: newStatus });
}
