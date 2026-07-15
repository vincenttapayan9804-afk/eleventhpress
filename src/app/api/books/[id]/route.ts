import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { deleteBookCascade } from "@/lib/book-delete";

/**
 * DELETE /api/books/[id]
 * Permanently removes a Book and every row that references it
 * (src/lib/book-delete.ts) — royalty statements, distribution records,
 * chapter links, invoices, production jobs. Does NOT delete any Article
 * that was a chapter (BookArticle is a pure join table). SUPER_ADMIN
 * only, same rationale as DELETE /api/articles/[id]. Writes an AuditLog
 * entry after the row is gone.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  const { id } = await params;
  const book = await db.book.findUnique({ where: { id } });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  await deleteBookCascade(book, { deleteFiles: true });

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "BOOK_DELETED",
      entityType: "BOOK",
      entityId: book.id,
      metadata: JSON.stringify({ title: book.title, isbn: book.isbn, status: book.status }),
    },
  });

  return NextResponse.json({ ok: true });
}
