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
  // Whitelabel Phase 7 — a second, independent gate specifically for the
  // content this endpoint otherwise refuses to touch (see blockers below).
  // Defaults to false so every existing caller of this endpoint keeps its
  // current, safer behavior (report blockers, delete nothing) unless it
  // explicitly opts into the destructive path.
  confirmDestructiveCascade: z.boolean().optional().default(false),
});

/**
 * Whitelabel Phase 7 — deletes one Article and everything that
 * transitively belongs to only that article, in the order its foreign
 * keys require. Derived from a live `information_schema` query against
 * every table with a FK into Article: 5 tables CASCADE or SET NULL
 * automatically at the database level (ArticleChunk,
 * ArticleGalleyTranslation, ArticleSimilarityExplanation x2,
 * ReadingHistory cascade; AuditLog/Invoice/Notification set null) and
 * need no code here. The other 13 are ON DELETE RESTRICT and have no
 * dependents of their own (verified the same way), so deleting each of
 * their rows for this article, then the Article row itself, is sufficient
 * — no further fan-out beneath them.
 */
async function deleteArticleCascade(tx: any, articleId: string) {
  await tx.articleDownload.deleteMany({ where: { articleId } });
  await tx.articleEmbedding.deleteMany({ where: { articleId } });
  await tx.authorResponse.deleteMany({ where: { articleId } });
  await tx.bookArticle.deleteMany({ where: { articleId } });
  await tx.collectionArticle.deleteMany({ where: { articleId } });
  await tx.correction.deleteMany({ where: { articleId } });
  await tx.datasetLink.deleteMany({ where: { articleId } });
  await tx.distribution.deleteMany({ where: { articleId } });
  await tx.editorialDecision.deleteMany({ where: { articleId } });
  await tx.editorialTriageReport.deleteMany({ where: { articleId } });
  await tx.independentReview.deleteMany({ where: { articleId } });
  await tx.reference.deleteMany({ where: { articleId } });
  await tx.review.deleteMany({ where: { articleId } });
  await tx.article.delete({ where: { id: articleId } });
}

/**
 * DELETE /api/admin/tenants/[id]/purge
 *
 * Whitelabel Phase 6 — deletes a tenant along with the *safe subset* of its
 * content: MediaPost and Collection (no non-cascading dependents), Magazine
 * (if it has no issues yet), and Podcast (episodes cascade automatically;
 * this pass also clears self-reported PodcastDistribution tracking rows,
 * which carry no financial/legal weight of their own). Without
 * `confirmDestructiveCascade`, Book rows with any BookDistribution/
 * RoyaltyStatement/BookArticle history and Journal rows with any
 * Issue/Article are reported as blockers rather than touched — those
 * represent real editorial/financial records, and a caller might just want
 * to know what's in the way, not necessarily destroy it.
 *
 * Whitelabel Phase 7 — with `confirmDestructiveCascade: true` (a second,
 * independent confirmation beyond `confirmSlug` — see PurgeSchema above),
 * this endpoint *will* permanently delete those Books and Journals,
 * including every Article under a blocked Journal via deleteArticleCascade
 * above (mapped from a live `information_schema` query of Article's full
 * ~20-table dependency fan-out — see that function's doc comment). Magazine
 * rows with issues remain blocked even under this flag: MagazineIssue's own
 * RESTRICT dependents (MagazineDistribution, MagazineIssueProductionJob)
 * aren't mapped to a safe deletion order here, so a magazine blocker still
 * stops the whole purge rather than being silently skipped.
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
      select: {
        id: true,
        title: true,
        _count: { select: { chapters: true, distributions: true, royaltyStatements: true } },
      },
    }),
    db.magazine.findMany({ where: { tenantId: id }, select: { id: true, name: true, _count: { select: { issues: true } } } }),
    db.podcast.findMany({ where: { tenantId: id }, select: { id: true, title: true } }),
    db.journal.findMany({
      where: { tenantId: id },
      select: { id: true, name: true, articles: { select: { id: true } }, issues: { select: { id: true } } },
    }),
  ]);

  const blockedBooks = books.filter((b) => b._count.chapters + b._count.distributions + b._count.royaltyStatements > 0);
  const blockedJournals = journals.filter((j) => j.articles.length + j.issues.length > 0);
  const blockedMagazines = magazines.filter((m) => m._count.issues > 0);

  const hasBlockers = blockedBooks.length > 0 || blockedMagazines.length > 0 || blockedJournals.length > 0;

  // Whitelabel Phase 7 — magazines with issues are still reported as a
  // blocker even under confirmDestructiveCascade: MagazineIssue's own
  // dependents include MagazineDistribution and
  // MagazineIssueProductionJob, both ON DELETE RESTRICT, which this pass
  // hasn't mapped a safe deletion order for the way it has for
  // Book/Journal/Article below. Reported the same as before rather than
  // silently skipped, so a caller who opts into the destructive path still
  // sees exactly what wasn't touched and why.
  if (hasBlockers && (!parsed.data.confirmDestructiveCascade || blockedMagazines.length > 0)) {
    return NextResponse.json(
      {
        error: parsed.data.confirmDestructiveCascade
          ? "This tenant has magazine issues this endpoint still won't destroy automatically. Remove or migrate them first."
          : "This tenant has content this endpoint won't destroy automatically without confirmDestructiveCascade. Remove or migrate it, or resend with that flag to permanently delete it (including editorial/financial history).",
        blockers: {
          books: blockedBooks.map((b) => ({ id: b.id, title: b.title, reason: "has chapters/distributions/royalty history" })),
          magazines: blockedMagazines.map((m) => ({ id: m.id, name: m.name, reason: "has issues" })),
          journals: blockedJournals.map((j) => ({ id: j.id, name: j.name, reason: "has articles/issues" })),
        },
      },
      { status: 409 }
    );
  }

  const purgedCounts: Record<string, number> = {
    books: books.length,
    magazines: magazines.length,
    podcasts: podcasts.length,
    journals: journals.length,
    articlesDeleted: blockedJournals.reduce((n, j) => n + j.articles.length, 0),
  };

  await db.$transaction(async (tx) => {
    // Destructive cascade path — only reached when confirmDestructiveCascade
    // was set and there were no remaining (magazine) blockers above.
    for (const book of blockedBooks) {
      await tx.bookArticle.deleteMany({ where: { bookId: book.id } });
      await tx.bookDistribution.deleteMany({ where: { bookId: book.id } });
      await tx.royaltyStatement.deleteMany({ where: { bookId: book.id } });
    }
    for (const journal of blockedJournals) {
      for (const article of journal.articles) {
        await deleteArticleCascade(tx, article.id);
      }
      if (journal.issues.length) await tx.issue.deleteMany({ where: { id: { in: journal.issues.map((i) => i.id) } } });
    }

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
