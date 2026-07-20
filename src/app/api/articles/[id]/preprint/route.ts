import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { PREPRINT_ELIGIBLE_STATUSES, type ArticleStatus } from "@/lib/article";

/**
 * POST /api/articles/[id]/preprint
 * Body: { enable: boolean }
 *
 * Toggles whether a not-yet-published manuscript is publicly readable as
 * a preprint (Article.isPreprint) — src/app/api/preprints/* is the public
 * read side. Corresponding author or editorial staff only, and only while
 * the manuscript is in one of PREPRINT_ELIGIBLE_STATUSES (src/lib/
 * article.ts) — a draft was never submitted, a published article is
 * already the real archive, and a rejected/withdrawn one shouldn't newly
 * become publicly browsable.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const { enable } = (await req.json()) as { enable?: boolean };

  const article = await db.article.findUnique({ where: { id } });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const isEditor = ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(session.role);
  const isOwner = article.correspondingAuthorId === session.userId;
  if (!isEditor && !isOwner) {
    return NextResponse.json({ error: "Not authorized for this article" }, { status: 403 });
  }

  if (enable && !PREPRINT_ELIGIBLE_STATUSES.includes(article.status as ArticleStatus)) {
    return NextResponse.json(
      { error: `Cannot post as a preprint while status is ${article.status}` },
      { status: 400 }
    );
  }

  const updated = await db.article.update({
    where: { id },
    data: {
      isPreprint: !!enable,
      preprintPostedAt: enable ? article.preprintPostedAt ?? new Date() : article.preprintPostedAt,
    },
  });

  return NextResponse.json({ isPreprint: updated.isPreprint, preprintPostedAt: updated.preprintPostedAt });
}
