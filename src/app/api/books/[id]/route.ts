import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { deleteBookCascade } from "@/lib/book-delete";

/**
 * DELETE /api/books/[id]
 * Permanently removes a Book and every row that references it
 * (src/lib/book-delete.ts) — royalty statements, distribution records,
 * chapter links, invoices, production jobs. Does NOT delete any Article
 * that was a chapter (BookArticle is a pure join table).
 *
 * SUPER_ADMIN can delete any book, any status. The corresponding author
 * can delete their own book only while it's pre-publication — same
 * rationale as DELETE /api/articles/[id] (a published book can carry an
 * ISBN/EPUB already distributed to aggregators; deletion has no undo).
 * Writes an AuditLog entry after the row is gone.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const book = await db.book.findUnique({ where: { id } });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const isAdmin = session.role === "SUPER_ADMIN";
  const isOwner = session.userId === book.correspondingAuthorId;

  if (!isAdmin) {
    if (!isOwner) {
      return NextResponse.json({ error: "Not authorized to delete this book" }, { status: 403 });
    }
    if (book.status === "PUBLISHED") {
      return NextResponse.json(
        { error: "Published books can't be deleted by the author — contact an admin." },
        { status: 403 }
      );
    }
  }

  await deleteBookCascade(book, { deleteFiles: true });

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "BOOK_DELETED",
      entityType: "BOOK",
      entityId: book.id,
      metadata: JSON.stringify({
        title: book.title,
        isbn: book.isbn,
        status: book.status,
        deletedBy: isAdmin ? "SUPER_ADMIN" : "AUTHOR",
      }),
    },
  });

  return NextResponse.json({ ok: true });
}
