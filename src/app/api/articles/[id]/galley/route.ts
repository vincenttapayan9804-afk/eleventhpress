import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { presignGet, objectExists } from "@/lib/storage";

/**
 * GET /api/articles/[id]/galley?format=pdf|html
 *
 * Returns a short-lived pre-signed download URL for the requested galley.
 * The gateway checks subscription status (Reader role must have an ACTIVE
 * subscription; Authors get free access to their own articles; Editors
 * get access to everything).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") || "pdf").toLowerCase();
  if (!["pdf", "html"].includes(format)) {
    return NextResponse.json({ error: "format must be pdf or html" }, { status: 400 });
  }

  const session = getSessionFromHeaders(req.headers);
  const article = await db.article.findUnique({
    where: { id },
    include: { journal: true, issue: true },
  });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }
  if (article.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Article is not published" }, { status: 403 });
  }

  const galleyKey = format === "pdf" ? article.galleyPdfKey : article.galleyHtmlKey;
  if (!galleyKey) {
    return NextResponse.json({ error: "Galley not yet generated" }, { status: 404 });
  }

  // Authorization: Reader must have an active subscription. Authors have
  // free access to their own articles. Editors & admins get access to all.
  if (session) {
    const isAuthor = article.correspondingAuthorId === session.userId;
    const isEditor = ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(session.role);
    if (!isAuthor && !isEditor && session.role === "READER") {
      const sub = await db.subscription.findFirst({
        where: { userId: session.userId, status: "ACTIVE" },
      });
      if (!sub) {
        return NextResponse.json(
          {
            error: "Payment Required",
            code: 402,
            message:
              "An active reader subscription is required to download galleys. Subscribe via your dashboard to enable PDF/HTML access.",
          },
          { status: 402 }
        );
      }
    }
  } else {
    // Unauthenticated request — return 401 (in production the gateway would
    // redirect to the login page).
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Check that the galley actually exists in storage; if not, fall back to
  // a generated placeholder URL (the article-view will gracefully degrade).
  const exists = await objectExists(galleyKey);
  if (!exists) {
    return NextResponse.json(
      {
        error: "Galley not yet deposited in storage",
        key: galleyKey,
        message:
          "The galley file has not been uploaded to the storage layer yet. For seed-published articles the galley is generated on demand when an editor re-publishes the article.",
      },
      { status: 404 }
    );
  }

  const downloadFilename = `${article.doi?.replace(/[^a-z0-9]/gi, "-") || article.id}.${format}`;
  const url = await presignGet(galleyKey, downloadFilename);
  return NextResponse.json({ url, key: galleyKey, format, expiresInSeconds: 600 });
}
