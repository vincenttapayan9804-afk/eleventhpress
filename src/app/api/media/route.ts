import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { presignGet } from "@/lib/storage";
import { getSessionFromHeaders, requireRole } from "@/lib/auth";
import { PRIVILEGED_ROLES_LIST as PRIVILEGED_ROLES } from "@/lib/roles";

const TYPES = new Set(["NEWS", "BLOG"]);

/**
 * GET /api/media?type=NEWS|BLOG
 * Public callers get PUBLISHED posts only; editorial staff can pass
 * ?all=1 to see DRAFTs too (the editorial queue). Optional ?type filter.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  if (type && !TYPES.has(type)) {
    return NextResponse.json({ error: `type must be one of ${[...TYPES].join(", ")}` }, { status: 400 });
  }

  const session = getSessionFromHeaders(req.headers);
  const wantsAll = searchParams.get("all") === "1";
  const canSeeAll = wantsAll && !!session && PRIVILEGED_ROLES.includes(session.role);

  const posts = await db.mediaPost.findMany({
    where: { ...(type ? { type } : {}), ...(canSeeAll ? {} : { status: "PUBLISHED" }) },
    orderBy: canSeeAll ? { createdAt: "desc" } : { publishedAt: "desc" },
  });

  const withUrls = await Promise.all(
    posts.map(async (p) => ({ ...p, heroImageUrl: p.heroImageKey ? await presignGet(p.heroImageKey) : null }))
  );

  return NextResponse.json({ posts: withUrls });
}

/**
 * POST /api/media { type, title, dek?, authorName, bodyHtml, category, tags?, heroImageKey? }
 * Editorial-only — a news/blog post is staff-written, not externally
 * submitted (see prisma/schema.prisma's "Publications" section comment).
 */
export async function POST(req: NextRequest) {
  const auth = requireRole(req.headers, PRIVILEGED_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  const body = (await req.json()) as {
    type?: string;
    title?: string;
    dek?: string;
    authorName?: string;
    bodyHtml?: string;
    category?: string;
    tags?: string;
    heroImageKey?: string;
  };
  if (!body.type || !TYPES.has(body.type)) {
    return NextResponse.json({ error: `type must be one of ${[...TYPES].join(", ")}` }, { status: 400 });
  }
  if (!body.title || !body.authorName || !body.bodyHtml || !body.category) {
    return NextResponse.json({ error: "title, authorName, bodyHtml, and category are required" }, { status: 400 });
  }

  const post = await db.mediaPost.create({
    data: {
      type: body.type,
      title: body.title,
      dek: body.dek,
      authorName: body.authorName,
      bodyHtml: body.bodyHtml,
      category: body.category,
      tags: body.tags,
      heroImageKey: body.heroImageKey,
      createdById: session.userId,
      status: "DRAFT",
    },
  });

  return NextResponse.json({ post });
}
