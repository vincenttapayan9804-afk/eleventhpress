import type { SessionPayload } from "@/lib/auth";
import { PRIVILEGED_ROLES } from "@/lib/roles";

/**
 * Whether a viewer may read a non-published article's detail. PUBLISHED
 * articles are always public — callers should short-circuit on that
 * themselves rather than calling this. For anything still in the
 * submission/review/production pipeline, only the corresponding author or
 * editorial staff may see it: exactly the set of people GET
 * /api/articles/[id]'s only two legitimate callers (the public article page
 * for published work, and an author's own "My Submissions" list) already
 * assume access for — this closes the gap where the same unauthenticated
 * endpoint returned any article by id regardless of status.
 */
export function canViewUnpublishedArticle(
  correspondingAuthorId: string | null,
  session: SessionPayload | null
): boolean {
  if (!session) return false;
  if (PRIVILEGED_ROLES.has(session.role)) return true;
  return !!correspondingAuthorId && session.userId === correspondingAuthorId;
}
