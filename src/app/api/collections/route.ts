import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

const EDITOR_ROLES = ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"];

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * GET /api/collections
 *
 * Public browse listing of editor-curated Special Issues / Collections —
 * thematic bundles of already-PUBLISHED articles (direct reuse of the
 * Book/BookArticle join-table pattern, prisma/schema.prisma). Only ever
 * returns collections an editor has actually published (publishedAt set)
 * — one still being assembled stays invisible to readers.
 */
export async function GET() {
  const collections = await db.collection.findMany({
    where: { publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
    include: { _count: { select: { articles: true } } },
  });

  return NextResponse.json({
    items: collections.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      description: c.description,
      publishedAt: c.publishedAt,
      articleCount: c._count.articles,
    })),
  });
}

/**
 * POST /api/collections
 * Body: { title, description, articleIds?: string[] }
 *
 * Editor-only. Publishes immediately (publishedAt = now) — there's no
 * separate draft/review step for a collection the way there is for an
 * article; an editor assembling one privately can simply not call this
 * until it's ready. Any articleIds that aren't PUBLISHED are silently
 * skipped rather than erroring the whole request, since the editor is
 * usually pulling from a larger candidate list.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session || !EDITOR_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Editorial role required" }, { status: 403 });
  }

  const body = (await req.json()) as { title?: string; description?: string; articleIds?: string[] };
  const title = (body.title || "").trim();
  const description = (body.description || "").trim();
  if (!title || !description) {
    return NextResponse.json({ error: "title and description are required" }, { status: 400 });
  }

  const baseSlug = slugify(title) || "collection";
  let slug = baseSlug;
  let n = 1;
  while (await db.collection.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${++n}`;
  }

  const validArticleIds = body.articleIds?.length
    ? (
        await db.article.findMany({
          where: { id: { in: body.articleIds }, status: "PUBLISHED" },
          select: { id: true },
        })
      ).map((a) => a.id)
    : [];

  const collection = await db.collection.create({
    data: {
      title,
      slug,
      description,
      createdById: session.userId,
      publishedAt: new Date(),
      articles: {
        create: validArticleIds.map((articleId, order) => ({ articleId, order })),
      },
    },
  });

  return NextResponse.json({ id: collection.id, slug: collection.slug });
}
