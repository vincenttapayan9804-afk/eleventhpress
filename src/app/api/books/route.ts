import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { presignGet } from "@/lib/storage";
import { PRIVILEGED_ROLES_LIST as PRIVILEGED_ROLES } from "@/lib/roles";
const FORMATS = new Set(["MONOGRAPH", "EDITED_VOLUME", "ANTHOLOGY"]);

/**
 * GET /api/books
 * Unauthenticated callers get the public catalog — PUBLISHED books only,
 * regardless of any status/all params — for the header's public "Books"
 * browse page. AUTHOR/SUPER_ADMIN otherwise see their own submissions;
 * EDITOR/ASSOCIATE_EDITOR/SUPER_ADMIN can additionally pass ?all=1 to see
 * every submission (the acquisitions queue). Optional ?status filter
 * either way.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);

  if (!session) {
    const books = await db.book.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true, title: true, subtitle: true, authors: true, description: true,
        category: true, format: true, isbn: true, coverImageKey: true,
        epubKey: true, pdfKey: true, publishedAt: true,
      },
    });
    const withUrls = await Promise.all(
      books.map(async (b) => ({
        ...b,
        coverImageUrl: b.coverImageKey ? await presignGet(b.coverImageKey) : null,
        epubUrl: b.epubKey ? await presignGet(b.epubKey, `${b.title}.epub`) : null,
        pdfUrl: b.pdfKey ? await presignGet(b.pdfKey, `${b.title}.pdf`) : null,
        coverImageKey: undefined, epubKey: undefined, pdfKey: undefined,
      }))
    );
    return NextResponse.json({ books: withUrls });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const wantsAll = searchParams.get("all") === "1";

  const where: any = {};
  if (status) where.status = status;
  if (!(wantsAll && PRIVILEGED_ROLES.includes(session.role))) {
    where.correspondingAuthorId = session.userId;
  }

  const books = await db.book.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    include: { chapters: { include: { article: { select: { id: true, title: true } } }, orderBy: { chapterOrder: "asc" } } },
  });

  // Resolve real, directly-fetchable download URLs here (Blob's own public
  // URL when connected, this app's own download endpoint otherwise) —
  // never build a storage key into a URL on the frontend, since the
  // /api/storage/download route is a local-dev-only fallback that's never
  // hit once Blob storage is connected (see src/lib/storage.ts presignGet).
  const withUrls = await Promise.all(
    books.map(async (b) => ({
      ...b,
      epubUrl: b.epubKey ? await presignGet(b.epubKey, `${b.title}.epub`) : null,
      pdfUrl: b.pdfKey ? await presignGet(b.pdfKey, `${b.title}.pdf`) : null,
    }))
  );

  return NextResponse.json({ books: withUrls });
}

/**
 * POST /api/books
 * Body: { title, subtitle?, authors (JSON string), description, category,
 *   format, isbn?, price?, coverImageKey?, manuscriptKey? (MONOGRAPH),
 *   articleIds? (ordered, EDITED_VOLUME/ANTHOLOGY) }
 *
 * AUTHOR/EDITOR/ASSOCIATE_EDITOR/SUPER_ADMIN — editors submit most
 * EDITED_VOLUME/ANTHOLOGY compilations since those draw on other authors'
 * work, while individual authors mainly submit their own MONOGRAPH. For a
 * compiled volume, every articleId must be a PUBLISHED article —
 * compiling unpublished or non-existent work into a book isn't a
 * legitimate flow. (Note: this doesn't yet request separate consent from
 * each included article's author beyond the article having been
 * published under this journal's existing terms — a deliberate scope cut
 * for this first pass.)
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!["AUTHOR", "EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Author or editor role required" }, { status: 403 });
  }

  const body = (await req.json()) as {
    title?: string;
    subtitle?: string;
    authors?: string;
    description?: string;
    category?: string;
    format?: string;
    isbn?: string;
    price?: number;
    coverImageKey?: string;
    manuscriptKey?: string;
    articleIds?: string[];
  };

  if (!body.title || !body.authors || !body.description || !body.category || !body.format) {
    return NextResponse.json({ error: "title, authors, description, category, and format are required" }, { status: 400 });
  }
  if (!FORMATS.has(body.format)) {
    return NextResponse.json({ error: `format must be one of ${[...FORMATS].join(", ")}` }, { status: 400 });
  }

  let chapterLinks: { articleId: string; chapterOrder: number }[] = [];
  if (body.format !== "MONOGRAPH") {
    const articleIds = body.articleIds || [];
    if (articleIds.length === 0) {
      return NextResponse.json({ error: "articleIds is required for EDITED_VOLUME/ANTHOLOGY" }, { status: 400 });
    }
    const articles = await db.article.findMany({ where: { id: { in: articleIds } } });
    const byId = new Map(articles.map((a) => [a.id, a]));
    for (const id of articleIds) {
      const article = byId.get(id);
      if (!article || article.status !== "PUBLISHED") {
        return NextResponse.json({ error: `Article ${id} is not a published article` }, { status: 400 });
      }
    }
    chapterLinks = articleIds.map((id, i) => ({ articleId: id, chapterOrder: i }));
  }

  const book = await db.book.create({
    data: {
      title: body.title,
      subtitle: body.subtitle,
      authors: body.authors,
      description: body.description,
      category: body.category,
      format: body.format,
      isbn: body.isbn,
      price: body.price ?? 0,
      coverImageKey: body.coverImageKey,
      manuscriptKey: body.format === "MONOGRAPH" ? body.manuscriptKey : null,
      correspondingAuthorId: session.userId,
      status: "SUBMITTED",
      chapters: chapterLinks.length ? { create: chapterLinks } : undefined,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "BOOK_SUBMITTED",
      entityType: "BOOK",
      entityId: book.id,
      metadata: JSON.stringify({ format: book.format }),
    },
  });

  return NextResponse.json({ book });
}
