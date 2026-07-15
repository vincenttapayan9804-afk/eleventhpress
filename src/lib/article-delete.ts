/**
 * Permanent, cascading Article deletion. prisma/schema.prisma has no
 * onDelete: Cascade anywhere, so every enforced-FK child row must be
 * deleted before the Article row itself, inside one transaction so a
 * partial failure never leaves orphaned children. Shared by the admin
 * delete API route (src/app/api/articles/[id]/route.ts) and the
 * scripts/remove-seed-articles.ts one-off cleanup script — do not
 * duplicate this list elsewhere.
 */
import { db } from "@/lib/db";
import { deleteObject } from "@/lib/storage";
import type { Article } from "@prisma/client";

// Enforced foreign keys — must be deleted before the Article row.
export function articleForeignKeyDeletes(articleId: string) {
  return [
    db.correction.deleteMany({ where: { articleId } }),
    db.reference.deleteMany({ where: { articleId } }),
    db.review.deleteMany({ where: { articleId } }),
    db.editorialDecision.deleteMany({ where: { articleId } }),
    db.invoice.deleteMany({ where: { articleId } }),
    db.notification.deleteMany({ where: { articleId } }),
    db.auditLog.deleteMany({ where: { articleId } }),
    db.distribution.deleteMany({ where: { articleId } }),
    db.bookArticle.deleteMany({ where: { articleId } }),
    db.datasetLink.deleteMany({ where: { articleId } }),
    db.articleEmbedding.deleteMany({ where: { articleId } }),
    db.editorialTriageReport.deleteMany({ where: { articleId } }),
  ];
}

// articleId is a plain field (no @relation) on these — not FK-enforced,
// but real orphans if left behind.
export function articleUnenforcedDeletes(articleId: string) {
  return [
    db.galleyJob.deleteMany({ where: { articleId } }),
    db.integrityCheckJob.deleteMany({ where: { articleId } }),
    db.altTextJob.deleteMany({ where: { articleId } }),
    db.storageObject.deleteMany({ where: { articleId } }),
    db.counterEvent.deleteMany({ where: { articleId } }),
  ];
}

const FILE_KEY_FIELDS = [
  "manuscriptKey",
  "anonymizedKey",
  "galleyPdfKey",
  "galleyHtmlKey",
  "galleyJatsKey",
] as const;

/**
 * Deletes an Article and every row that references it. Does NOT write an
 * audit log entry itself — callers with a session (the API route) do that
 * after this resolves, since AuditLog.articleId can't point at a row that
 * no longer exists.
 */
export async function deleteArticleCascade(
  article: Article,
  opts: { deleteFiles?: boolean } = {}
): Promise<void> {
  await db.$transaction([
    ...articleForeignKeyDeletes(article.id),
    ...articleUnenforcedDeletes(article.id),
    db.article.delete({ where: { id: article.id } }),
  ]);

  if (opts.deleteFiles) {
    for (const field of FILE_KEY_FIELDS) {
      const key = article[field];
      if (!key) continue;
      try {
        await deleteObject(key);
      } catch {
        // best-effort — a missing/already-gone object shouldn't surface as an error
      }
    }
  }
}
