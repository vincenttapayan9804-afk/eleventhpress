import { db } from "@/lib/db";

/**
 * Who to tell about a review: the editor who sent the invitation (from the
 * ASSIGN_REVIEWER audit entry), or — when that can't be found — every
 * editor, as /api/reviews/submit already does.
 */
export async function editorsForReview(reviewId: string): Promise<string[]> {
  const assigned = await db.auditLog.findFirst({
    where: { action: "ASSIGN_REVIEWER", entityType: "REVIEW", entityId: reviewId },
    select: { userId: true },
  });
  if (assigned?.userId) return [assigned.userId];
  const editors = await db.user.findMany({
    where: { role: { in: ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"] } },
    select: { id: true },
  });
  return editors.map((e) => e.id);
}
