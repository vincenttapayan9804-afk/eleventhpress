/**
 * Permanent, cascading Book deletion — same rationale as
 * src/lib/article-delete.ts (no onDelete: Cascade in the schema, so
 * enforced-FK children must be deleted first inside one transaction).
 * Deleting a Book never touches the Article rows that are its chapters —
 * BookArticle is a pure join table, removing it only unlinks the chapter,
 * it doesn't delete the underlying Article.
 */
import { db } from "@/lib/db";
import { deleteObject } from "@/lib/storage";
import type { Book } from "@prisma/client";

// Enforced foreign keys — must be deleted before the Book row.
export function bookForeignKeyDeletes(bookId: string) {
  return [
    db.royaltyStatement.deleteMany({ where: { bookId } }),
    db.bookDistribution.deleteMany({ where: { bookId } }),
    db.bookArticle.deleteMany({ where: { bookId } }),
    db.invoice.deleteMany({ where: { bookId } }),
  ];
}

// bookId is a plain field (no @relation) on BookProductionJob — not
// FK-enforced, but a real orphan if left behind.
export function bookUnenforcedDeletes(bookId: string) {
  return [db.bookProductionJob.deleteMany({ where: { bookId } })];
}

const FILE_KEY_FIELDS = ["coverImageKey", "manuscriptKey", "epubKey", "pdfKey"] as const;

/**
 * Deletes a Book and every row that references it. Does NOT write an
 * audit log entry itself — the caller does that after this resolves.
 */
export async function deleteBookCascade(book: Book, opts: { deleteFiles?: boolean } = {}): Promise<void> {
  await db.$transaction([
    ...bookForeignKeyDeletes(book.id),
    ...bookUnenforcedDeletes(book.id),
    db.book.delete({ where: { id: book.id } }),
  ]);

  if (opts.deleteFiles) {
    for (const field of FILE_KEY_FIELDS) {
      const key = book[field];
      if (!key) continue;
      try {
        await deleteObject(key);
      } catch {
        // best-effort
      }
    }
  }
}
