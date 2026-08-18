import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { requireTenantScope } from "@/lib/tenant-auth";
import { TENANT_SCOPED_ADMIN_ROLES, ETHICS_SUBMISSION_STATUSES } from "@/lib/roles";
import { parseBody } from "@/lib/validate";

const REVIEW_TRANSITIONS = ETHICS_SUBMISSION_STATUSES.filter((s) => s !== "SUBMITTED");

const ReviewSchema = z.object({
  status: z.enum(REVIEW_TRANSITIONS as [string, ...string[]]),
  reviewNote: z.string().trim().max(5000).optional(),
  // Only meaningful (and settable) on APPROVED — auto-generated when omitted.
  protocolNumber: z.string().trim().min(1).max(64).optional(),
  // Only meaningful on APPROVED — an IRB protocol's expiry; ignored for COI disclosures.
  expiresAt: z.string().datetime().optional(),
});

function generateProtocolNumber(submissionType: string) {
  const prefix = submissionType === "IRB_PROTOCOL" ? "IRB" : "COI";
  const year = new Date().getFullYear();
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${year}-${suffix}`;
}

/**
 * POST /api/admin/ethics-submissions/[id]/review
 * EP University OS Phase 3 — reviewer decision, mirroring
 * /api/admin/users/[id]/department's tenant-scope + AuditLog shape.
 * Body: { status, reviewNote?, protocolNumber?, expiresAt? }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const submission = await db.ethicsSubmission.findUnique({ where: { id } });
  if (!submission) return NextResponse.json({ error: "Ethics submission not found" }, { status: 404 });

  const auth = requireTenantScope(req.headers, submission.tenantId, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  const parsed = await parseBody(req, ReviewSchema);
  if (!parsed.ok) return parsed.response;
  const { status, reviewNote, protocolNumber, expiresAt } = parsed.data;

  const updated = await db.ethicsSubmission.update({
    where: { id },
    data: {
      status,
      reviewNote: reviewNote ?? submission.reviewNote,
      reviewedByUserId: session.userId,
      reviewedAt: new Date(),
      ...(status === "APPROVED" && {
        protocolNumber: protocolNumber ?? submission.protocolNumber ?? generateProtocolNumber(submission.submissionType),
        expiresAt: expiresAt ? new Date(expiresAt) : submission.expiresAt,
      }),
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "ETHICS_SUBMISSION_REVIEW",
      entityType: "USER",
      entityId: submission.submittedByUserId,
      metadata: JSON.stringify({
        submissionId: id,
        submissionType: submission.submissionType,
        from: submission.status,
        to: status,
        protocolNumber: updated.protocolNumber,
      }),
    },
  });

  return NextResponse.json({ submission: updated });
}
