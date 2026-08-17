import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { z } from "zod";

const PurgeSchema = z.object({
  // Requiring the caller to echo the tenant's own slug back is the same
  // "type the thing to confirm" pattern used for other irreversible actions
  // elsewhere in the app — cheap insurance against a mis-clicked SUPER_ADMIN
  // request against the wrong tenant id.
  confirmSlug: z.string(),
});

/**
 * DELETE /api/admin/tenants/[id]/purge
 *
 * Whitelabel Phase 6 — deletes a tenant along with the *safe subset* of its
 * content: MediaPost and Collection (no non-cascading dependents), Magazine
 * (if it has no issues yet), and Podcast (episodes cascade automatically;
 * this pass also clears self-reported PodcastDistribution tracking rows,
 * which carry no financial/legal weight of their own).
 *
 * Deliberately does NOT touch Book rows that have any BookDistribution/
 * RoyaltyStatement/BookArticle history, or Journal rows that have any
 * Issue/Article — those represent real editorial/financial records, and
 * Article in particular fans out to ~20 dependent tables (reviews,
 * decisions, corrections, DOIs, invoices, embeddings, ...). Getting that
 * cascade right is real, separate work — same call Phase 5's export
 * endpoint doc comment already made ("a tenant data deletion/purge
 * endpoint needs its own careful cascade design"), not a decision that
 * became any safer to rush just because this pass touches the neighborhood.
 * A tenant with that kind of content reports it as a blocker instead of
 * silently destroying it.
 *
 * Requires zero users first (same precondition the plain tenant DELETE
 * route already enforces) — reassigning or removing user accounts is a
 * separate, deliberate action this endpoint doesn't take on a caller's
 * behalf.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const parsed = await parseBody(req, PurgeSchema);
  if (!parsed.ok) return parsed.response;

  const tenant = await db.tenant.findUnique({ where: { id } });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  if (tenant.isPlatform) {
    return NextResponse.json({ error: "Cannot purge the platform tenant" }, { status: 400 });
  }
  if (parsed.data.confirmSlug !== tenant.slug) {
    return NextResponse.json({ error: "confirmSlug does not match this tenant's slug" }, { status: 400 });
  }

  const userCount = await db.user.count({ where: { tenantId: id } });
  if (userCount > 0) {
    return NextResponse.json({ error: `Tenant has ${userCount} user(s) — reassign or remove them first` }, { status: 400 });
  }

  const [books, magazines, podcasts, journals] = await Promise.all([
    db.book.findMany({
      where: { tenantId: id },
      select: { id: true, title: true, _count: { select: { chapters: true, distributions: true, royaltyStatements: true } } },
    }),
    db.magazine.findMany({ where: { tenantId: id }, select: { id: true, name: true, _count: { select: { issues: true } } } }),
    db.podcast.findMany({ where: { tenantId: id }, select: { id: true, title: true } }),
    db.journal.findMany({ where: { tenantId: id }, select: { id: true, name: true, _count: { select: { articles: true, issues: true } } } }),
  ]);

  const blockedBooks = books.filter((b) => b._count.chapters + b._count.distributions + b._count.royaltyStatements > 0);
  const blockedMagazines = magazines.filter((m) => m._count.issues > 0);
  const blockedJournals = journals.filter((j) => j._count.articles + j._count.issues > 0);

  if (blockedBooks.length || blockedMagazines.length || blockedJournals.length) {
    return NextResponse.json(
      {
        error: "This tenant has content this endpoint won't destroy automatically. Remove or migrate it first.",
        blockers: {
          books: blockedBooks.map((b) => ({ id: b.id, title: b.title, reason: "has chapters/distributions/royalty history" })),
          magazines: blockedMagazines.map((m) => ({ id: m.id, name: m.name, reason: "has issues" })),
          journals: blockedJournals.map((j) => ({ id: j.id, name: j.name, reason: "has articles/issues" })),
        },
      },
      { status: 409 }
    );
  }

  const purgedCounts = { books: books.length, magazines: magazines.length, podcasts: podcasts.length, journals: journals.length };

  await db.$transaction(async (tx) => {
    if (books.length) await tx.book.deleteMany({ where: { id: { in: books.map((b) => b.id) } } });
    if (magazines.length) await tx.magazine.deleteMany({ where: { id: { in: magazines.map((m) => m.id) } } });
    if (podcasts.length) {
      const podcastIds = podcasts.map((p) => p.id);
      await tx.podcastDistribution.deleteMany({ where: { podcastId: { in: podcastIds } } });
      await tx.podcast.deleteMany({ where: { id: { in: podcastIds } } });
    }
    if (journals.length) await tx.journal.deleteMany({ where: { id: { in: journals.map((j) => j.id) } } });
    await tx.mediaPost.deleteMany({ where: { tenantId: id } });
    await tx.collection.deleteMany({ where: { tenantId: id } });
    await tx.tenantDomain.deleteMany({ where: { tenantId: id } });
    await tx.tenant.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true, purged: purgedCounts });
}
