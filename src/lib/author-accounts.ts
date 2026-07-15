/**
 * Batch-resolves an article's `authors` JSON entries to a matching
 * registered User's avatarUrl, via ORCID first then account email — the
 * same precedence the public Authors' Directory
 * (src/app/api/authors/route.ts) already uses to cross-reference accounts.
 * Most co-authors never register an account, so a `null` result (no match)
 * is the normal case, not an error — callers fall back to initials.
 */
import { db } from "@/lib/db";
import type { ArticleAuthor } from "@/lib/article";

/** One avatarUrl (or null) per input author, in the same order. */
export async function resolveAuthorAvatars(authors: ArticleAuthor[]): Promise<(string | null)[]> {
  const orcids = authors.map((a) => a.orcid).filter((v): v is string => !!v);
  const emails = authors.map((a) => a.email).filter((v): v is string => !!v);
  if (orcids.length === 0 && emails.length === 0) {
    return authors.map(() => null);
  }

  const accounts = await db.user.findMany({
    where: {
      OR: [
        ...(orcids.length ? [{ orcid: { in: orcids } }] : []),
        ...(emails.length ? [{ email: { in: emails } }] : []),
      ],
    },
    select: { orcid: true, email: true, avatarUrl: true },
  });
  const byOrcid = new Map(accounts.filter((u) => u.orcid).map((u) => [u.orcid as string, u.avatarUrl]));
  const byEmail = new Map(accounts.map((u) => [u.email.toLowerCase(), u.avatarUrl]));

  return authors.map(
    (a) => (a.orcid && byOrcid.get(a.orcid)) || (a.email && byEmail.get(a.email.toLowerCase())) || null
  );
}
