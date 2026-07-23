import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { presignGet } from "@/lib/storage";
import { requireRole } from "@/lib/auth";
import { PRIVILEGED_ROLES_LIST as PRIVILEGED_ROLES } from "@/lib/roles";

/**
 * GET /api/magazines
 * Public — every magazine title is visible (there's no draft/hidden state
 * at the magazine level, only at the issue level, same as Journal). Each
 * entry includes its published-issue count so the browse page can show
 * "3 issues" without a second round trip.
 */
export async function GET() {
  const magazines = await db.magazine.findMany({
    orderBy: { name: "asc" },
    include: { issues: { where: { status: "PUBLISHED" }, select: { id: true } } },
  });

  const withUrls = await Promise.all(
    magazines.map(async (m) => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      description: m.description,
      coverImageUrl: m.coverImageKey ? await presignGet(m.coverImageKey) : null,
      issueCount: m.issues.length,
    }))
  );

  return NextResponse.json({ magazines: withUrls });
}

/**
 * POST /api/magazines { name, slug, description, coverImageKey? }
 * Editorial-only — a magazine title is a masthead staff sets up, not
 * something an external author submits (see prisma/schema.prisma's
 * "Publications" section comment for why this doesn't reuse Article/Book).
 */
export async function POST(req: NextRequest) {
  const auth = requireRole(req.headers, PRIVILEGED_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await req.json()) as { name?: string; slug?: string; description?: string; coverImageKey?: string };
  if (!body.name || !body.slug || !body.description) {
    return NextResponse.json({ error: "name, slug, and description are required" }, { status: 400 });
  }
  if (!/^[a-z0-9-]+$/.test(body.slug)) {
    return NextResponse.json({ error: "slug must be lowercase letters, numbers, and hyphens only" }, { status: 400 });
  }

  const existing = await db.magazine.findUnique({ where: { slug: body.slug } });
  if (existing) return NextResponse.json({ error: "That slug is already in use" }, { status: 409 });

  const magazine = await db.magazine.create({
    data: { name: body.name, slug: body.slug, description: body.description, coverImageKey: body.coverImageKey },
  });

  return NextResponse.json({ magazine });
}
