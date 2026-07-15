import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/editorial-board
 * Public directory of the journal's actual editorial staff — the accounts
 * with editorial authority in the real RBAC system (src/lib/auth.ts),
 * not a separate hand-maintained board record that could drift out of
 * sync with who can actually make editorial decisions. SUPER_ADMIN,
 * EDITOR, and ASSOCIATE_EDITOR is the same three-role bundle already
 * treated as "editorial staff" elsewhere (e.g. the ai-assist route's
 * authorization check), reused here for consistency.
 *
 * Only public profile fields are exposed — never the private login
 * email, password hash, or OAuth tokens also on the User row.
 */
const BOARD_ROLES = ["SUPER_ADMIN", "EDITOR", "ASSOCIATE_EDITOR"] as const;
const ROLE_RANK: Record<string, number> = { SUPER_ADMIN: 0, EDITOR: 1, ASSOCIATE_EDITOR: 2 };
const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Editor-in-Chief",
  EDITOR: "Editor",
  ASSOCIATE_EDITOR: "Associate Editor",
};

export async function GET() {
  const members = await db.user.findMany({
    where: { role: { in: [...BOARD_ROLES] } },
    select: {
      id: true,
      fullName: true,
      role: true,
      affiliation: true,
      profession: true,
      bio: true,
      orcid: true,
      avatarUrl: true,
      website: true,
      twitterUrl: true,
      linkedinUrl: true,
      githubUrl: true,
      contactEmail: true,
    },
  });

  const board = members
    .map((m) => ({ ...m, roleLabel: ROLE_LABEL[m.role] || m.role }))
    .sort((a, b) => (ROLE_RANK[a.role] ?? 99) - (ROLE_RANK[b.role] ?? 99) || a.fullName.localeCompare(b.fullName));

  return NextResponse.json(
    { board, total: board.length },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } }
  );
}
