/**
 * Tier 3 "team workspace" access check for a ResearchLabDocument — a
 * document is visible to its owner and to anyone it's been explicitly
 * shared with (src/app/api/research-lab/documents/[id]/share/route.ts).
 * Deliberately read-only for non-owners: editing (PATCH) stays owner-only
 * everywhere it's checked, since there's no conflict-resolution story for
 * concurrent edits to originalResultJson.
 */
import { db } from "@/lib/db";

export async function canViewResearchLabDocument(documentId: string, userId: string): Promise<boolean> {
  const share = await db.researchLabDocumentShare.findUnique({
    where: { documentId_sharedWithUserId: { documentId, sharedWithUserId: userId } },
  });
  return !!share;
}
