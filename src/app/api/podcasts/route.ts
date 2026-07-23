import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { presignGet } from "@/lib/storage";
import { requireRole } from "@/lib/auth";
import { PRIVILEGED_ROLES_LIST as PRIVILEGED_ROLES } from "@/lib/roles";

/**
 * GET /api/podcasts
 * Public — every show is visible (there's no draft/hidden state at the
 * show level, only at the episode level). Each entry includes its
 * published-episode count so the browse page can show "12 episodes"
 * without a second round trip.
 */
export async function GET() {
  const podcasts = await db.podcast.findMany({
    orderBy: { title: "asc" },
    include: { episodes: { where: { status: "PUBLISHED" }, select: { id: true } } },
  });

  const withUrls = await Promise.all(
    podcasts.map(async (p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      description: p.description,
      category: p.category,
      hosts: p.hosts,
      coverImageUrl: p.coverImageKey ? await presignGet(p.coverImageKey) : null,
      episodeCount: p.episodes.length,
    }))
  );

  return NextResponse.json({ podcasts: withUrls });
}

/**
 * POST /api/podcasts { title, slug, description, hosts (JSON string), category, coverImageKey?, language?, explicit? }
 * Editorial-only — a show is set up by staff, not submitted by an external
 * author (see prisma/schema.prisma's "Publications" section comment).
 */
export async function POST(req: NextRequest) {
  const auth = requireRole(req.headers, PRIVILEGED_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  const body = (await req.json()) as {
    title?: string;
    slug?: string;
    description?: string;
    hosts?: string;
    category?: string;
    coverImageKey?: string;
    language?: string;
    explicit?: boolean;
  };
  if (!body.title || !body.slug || !body.description || !body.hosts || !body.category) {
    return NextResponse.json({ error: "title, slug, description, hosts, and category are required" }, { status: 400 });
  }
  if (!/^[a-z0-9-]+$/.test(body.slug)) {
    return NextResponse.json({ error: "slug must be lowercase letters, numbers, and hyphens only" }, { status: 400 });
  }

  const existing = await db.podcast.findUnique({ where: { slug: body.slug } });
  if (existing) return NextResponse.json({ error: "That slug is already in use" }, { status: 409 });

  const podcast = await db.podcast.create({
    data: {
      title: body.title,
      slug: body.slug,
      description: body.description,
      hosts: body.hosts,
      category: body.category,
      coverImageKey: body.coverImageKey,
      language: body.language || "eng",
      explicit: !!body.explicit,
      createdById: session.userId,
    },
  });

  return NextResponse.json({ podcast });
}
