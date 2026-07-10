import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { depositToZenodo } from "@/lib/zenodo";
import { parseAuthors } from "@/lib/article";

/**
 * POST /api/datasets/zenodo
 * Body: { articleId, title, description, keywords, license, accessRight }
 *
 * Deposits a dataset to Zenodo (or simulates if no ZENODO_TOKEN).
 * Creates a DatasetLink record and notifies the editor + author.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!["AUTHOR", "EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Author or editor role required" }, { status: 403 });
  }

  const body = (await req.json()) as {
    articleId: string;
    title: string;
    description: string;
    keywords: string[];
    license: string;
    accessRight: string;
  };

  const article = await db.article.findUnique({
    where: { id: body.articleId },
    select: { id: true, title: true, authors: true, doi: true, correspondingAuthorId: true },
  });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const authors = parseAuthors(article.authors);
  const result = await depositToZenodo({
    articleId: body.articleId,
    title: body.title,
    description: body.description,
    creators: authors.map((a) => ({
      name: a.name,
      affiliation: a.affiliation,
      orcid: a.orcid,
    })),
    keywords: body.keywords,
    license: body.license,
    accessRight: body.accessRight,
    depositorId: session.userId,
  });

  // Audit log
  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "DATASET_DEPOSITED",
      entityType: "ARTICLE",
      entityId: body.articleId,
      articleId: body.articleId,
      metadata: JSON.stringify({
        repository: "ZENODO",
        mode: result.mode,
        datasetDoi: result.datasetDoi,
        ok: result.ok,
      }),
    },
  });

  // Notify author
  if (article.correspondingAuthorId) {
    await db.notification.create({
      data: {
        userId: article.correspondingAuthorId,
        type: result.ok ? "SUCCESS" : "ERROR",
        title: result.ok ? "Dataset deposited on Zenodo" : "Dataset deposit failed",
        message: result.ok
          ? `Dataset "${body.title}" for "${article.title}" is now available at ${result.datasetUrl} (DOI: ${result.datasetDoi}). The dataset will be linked on the article page and the Crossref relation will be deposited on next publication.`
          : `Dataset deposit failed: ${result.message}`,
        articleId: body.articleId,
      },
    });
  }

  return NextResponse.json(result);
}

/**
 * GET /api/datasets/zenodo?articleId=…
 * Returns all dataset links for an article.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const articleId = searchParams.get("articleId");
  if (!articleId) return NextResponse.json({ error: "articleId required" }, { status: 400 });

  const datasets = await db.datasetLink.findMany({
    where: { articleId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ datasets });
}
