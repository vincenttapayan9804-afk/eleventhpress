import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { getBookPlatform, buildBookPackage, BOOK_PLATFORMS } from "@/lib/book-distribution";

const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "EDITOR", "ASSOCIATE_EDITOR"]);

async function canManage(bookCorrespondingAuthorId: string | null, session: { userId: string; role: string }) {
  if (PRIVILEGED_ROLES.has(session.role)) return true;
  return !!bookCorrespondingAuthorId && session.userId === bookCorrespondingAuthorId;
}

/**
 * GET /api/book-distribution?bookId=X
 * Lists every BookDistribution row for the book, including platforms that
 * have never been generated (returned as NOT_STARTED stubs), same shape as
 * GET /api/distribution for articles.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const bookId = new URL(req.url).searchParams.get("bookId");
  if (!bookId) return NextResponse.json({ error: "bookId is required" }, { status: 400 });

  const book = await db.book.findUnique({ where: { id: bookId } });
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canManage(book.correspondingAuthorId, session))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (book.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Distribution is only available for published books" }, { status: 400 });
  }

  const rows = await db.bookDistribution.findMany({ where: { bookId } });
  const byPlatform = new Map(rows.map((r) => [r.platform, r]));

  const items = BOOK_PLATFORMS.map((p) => {
    const existing = byPlatform.get(p.id);
    return existing || {
      id: null,
      bookId,
      platform: p.id,
      tier: p.tier,
      status: "NOT_STARTED",
      packageContent: null,
      externalUrl: null,
      submittedAt: null,
    };
  });

  return NextResponse.json({ items });
}

/**
 * POST /api/book-distribution { bookId, platform, consent? }
 * Generates (or regenerates) the metadata package for a platform. Upserts
 * on the (bookId, platform) unique constraint, same as /api/distribution.
 *
 * Requires the book to be PUBLISHED with a finished EPUB (epubKey) present
 * — these are full-manuscript distributors, they don't take a manuscript
 * still in production. Tier B platforms (Draft2Digital/IngramSpark)
 * additionally require `consent: true` on this call (or an already-recorded
 * consent from a prior call) before a package is generated.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { bookId, platform, consent } = (await req.json()) as { bookId?: string; platform?: string; consent?: boolean };
  if (!bookId || !platform) {
    return NextResponse.json({ error: "bookId and platform are required" }, { status: 400 });
  }
  const platformDef = getBookPlatform(platform);
  if (!platformDef) return NextResponse.json({ error: `Unknown platform: ${platform}` }, { status: 400 });

  const book = await db.book.findUnique({ where: { id: bookId } });
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canManage(book.correspondingAuthorId, session))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (book.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Distribution is only available for published books" }, { status: 400 });
  }
  if (!book.epubKey) {
    return NextResponse.json({ error: "This book has no finished EPUB yet — production must complete before it can be distributed" }, { status: 400 });
  }

  let hasConsent = false;
  if (platformDef.tier === "B") {
    if (!book.distributionPackagePaidAt) {
      return NextResponse.json(
        { error: "The Distribution Package must be purchased before generating a wide-distribution submission package for this book." },
        { status: 402 }
      );
    }
    const existing = await db.bookDistribution.findUnique({ where: { bookId_platform: { bookId, platform } } });
    hasConsent = !!consent || !!existing?.authorConsent;
    if (!hasConsent) {
      return NextResponse.json({ error: "Author consent is required before generating a submission package for this platform" }, { status: 400 });
    }
  }

  const pkg = buildBookPackage(book);

  const row = await db.bookDistribution.upsert({
    where: { bookId_platform: { bookId, platform } },
    create: {
      bookId,
      platform,
      tier: platformDef.tier,
      status: "PACKAGE_READY",
      packageContent: JSON.stringify(pkg),
      authorConsent: hasConsent,
      consentedAt: hasConsent ? new Date() : null,
    },
    update: {
      status: "PACKAGE_READY",
      packageContent: JSON.stringify(pkg),
      ...(hasConsent ? { authorConsent: true, consentedAt: new Date() } : {}),
    },
  });

  return NextResponse.json({ item: row, package: pkg });
}
