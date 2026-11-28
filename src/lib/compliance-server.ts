import { db } from "@/lib/db";

/** Writes one audit-log row for a register change. Never includes policy text or secrets. */
export async function auditCompliance(userId: string, action: string, entityId: string, metadata: Record<string, unknown>) {
  await db.auditLog.create({
    data: { userId, action, entityType: "COMPLIANCE", entityId, metadata: JSON.stringify(metadata) },
  });
}
