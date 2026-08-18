import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { PRIVILEGED_ROLES_LIST } from "@/lib/roles";
import { db } from "@/lib/db";

const RESEARCH_LAB_ACTIONS = ["RESEARCH_LAB_DOCUMENT_CREATED", "RESEARCH_LAB_DOCUMENT_EDITED", "RESEARCH_LAB_DOCUMENT_SHARED", "TRANSCRIPTION_GENERATED"];

/**
 * GET /api/admin/research-lab-activity
 * Tier 3 institutional-governance surface: real, aggregated usage of the
 * Eleventh Research Lab (Gap Finder, PRISMA drafting, transcription) for
 * editorial staff overseeing the tool — every number here is a live
 * count/groupBy against ResearchLabDocument/TranscriptionJob/AuditLog,
 * never an estimate, since this is exactly the kind of "how is this
 * feature actually being used" question an invented number would corrupt.
 */
export async function GET(req: NextRequest) {
  const auth = requireRole(req.headers, PRIVILEGED_ROLES_LIST);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const [docCounts, jobCounts, editedCount, sharedCount, recentAudit, topUsersRaw] = await Promise.all([
    db.researchLabDocument.groupBy({ by: ["kind"], _count: { _all: true } }),
    db.transcriptionJob.groupBy({ by: ["status"], _count: { _all: true } }),
    db.researchLabDocument.count({ where: { editedAt: { not: null } } }),
    db.researchLabDocumentShare.count(),
    db.auditLog.findMany({
      where: { action: { in: RESEARCH_LAB_ACTIONS } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    db.researchLabDocument.groupBy({ by: ["userId"], _count: { _all: true }, orderBy: { _count: { userId: "desc" } }, take: 10 }),
  ]);

  const userIds = [...new Set([...recentAudit.map((a) => a.userId).filter((v): v is string => !!v), ...topUsersRaw.map((u) => u.userId)])];
  const users = userIds.length ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true, email: true } }) : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  return NextResponse.json({
    documentsByKind: docCounts.map((d) => ({ kind: d.kind, count: d._count._all })),
    transcriptionsByStatus: jobCounts.map((j) => ({ status: j.status, count: j._count._all })),
    editedDocumentCount: editedCount,
    activeShareCount: sharedCount,
    topContributors: topUsersRaw.map((u) => ({ user: userById.get(u.userId) ?? null, documentCount: u._count._all })),
    recentActivity: recentAudit.map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      user: a.userId ? (userById.get(a.userId) ?? null) : null,
      metadata: a.metadata ? JSON.parse(a.metadata) : null,
      createdAt: a.createdAt,
    })),
  });
}
