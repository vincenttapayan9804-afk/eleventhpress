import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { presignGet } from "@/lib/storage";
import { getSessionFromHeaders, requireRole } from "@/lib/auth";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { withRlsContext, withTenantRlsContext } from "@/lib/db-rls";
import { PRIVILEGED_ROLES_LIST as PRIVILEGED_ROLES } from "@/lib/roles";

/**
 * GET /api/podcasts/[id]
 * Public callers see PUBLISHED episodes only; editorial staff additionally
 * see DRAFT episodes for the management dashboard.
 *
 * Whitelabel Phase 8 — scoped by the resolved tenant, matching GET
 * /api/podcasts; an id from a different tenant 404s at the app layer, and
 * the read runs inside withTenantRlsContext for RLS activation coverage.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await resolveTenantFromHeaders(req.headers);
  const tenantId = tenant?.id ?? null;
  const podcast = await withTenantRlsContext(tenantId, (tx) =>
    tx.podcast.findFirst({ where: { id, tenantId } })
  );
  if (!podcast) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = getSessionFromHeaders(req.headers);
  const canSeeAll = !!session && PRIVILEGED_ROLES.includes(session.role);

  const episodes = await withTenantRlsContext(tenantId, (tx) =>
    tx.podcastEpisode.findMany({
      where: canSeeAll ? { podcastId: id } : { podcastId: id, status: "PUBLISHED" },
      orderBy: [{ seasonNumber: "desc" }, { episodeNumber: "desc" }],
    })
  );

  const episodesWithUrls = await Promise.all(
    episodes.map(async (e) => ({ ...e, audioUrl: e.audioKey ? await presignGet(e.audioKey) : null }))
  );

  return NextResponse.json({
    podcast: { ...podcast, coverImageUrl: podcast.coverImageKey ? await presignGet(podcast.coverImageKey) : null },
    episodes: episodesWithUrls,
  });
}

/** PATCH /api/podcasts/[id] { title?, description?, hosts?, category?, coverImageKey?, explicit? } — editorial-only. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, PRIVILEGED_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const existing = await withRlsContext(auth.session, (tx) => tx.podcast.findUnique({ where: { id } }));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as {
    title?: string;
    description?: string;
    hosts?: string;
    category?: string;
    coverImageKey?: string;
    explicit?: boolean;
  };

  const podcast = await db.podcast.update({
    where: { id },
    data: {
      title: body.title ?? existing.title,
      description: body.description ?? existing.description,
      hosts: body.hosts ?? existing.hosts,
      category: body.category ?? existing.category,
      coverImageKey: body.coverImageKey ?? existing.coverImageKey,
      explicit: body.explicit ?? existing.explicit,
    },
  });

  return NextResponse.json({ podcast });
}
