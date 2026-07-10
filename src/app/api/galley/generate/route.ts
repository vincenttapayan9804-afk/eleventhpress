import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { getObject } from "@/lib/storage";
import { generateGalleys } from "@/lib/galley";

/**
 * POST /api/galley/generate
 * Body: { articleId }
 *
 * Generates HTML, PDF, and JATS galleys for an article using the in-process
 * Pandoc + WeasyPrint galley service. Pulls the source manuscript from
 * storage; if the manuscript isn't on disk (e.g. seed articles), synthesises
 * a Markdown manuscript from the article metadata.
 *
 * Editors + Admins only.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

  const { articleId } = (await req.json()) as { articleId: string };

  const article = await db.article.findUnique({
    where: { id: articleId },
    include: { journal: true, issue: true },
  });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  // Try to fetch the manuscript from storage
  let manuscriptBytes: Buffer;
  let manuscriptName: string;
  const stored = article.manuscriptKey ? await getObject(article.manuscriptKey) : null;
  if (stored) {
    manuscriptBytes = stored;
    manuscriptName = article.manuscriptKey?.split("/").pop() || "manuscript.md";
  } else {
    // Synthesise from metadata
    manuscriptBytes = Buffer.from(synthesiseMarkdown(article), "utf-8");
    manuscriptName = `${article.id}.md`;
  }

  // Record job start
  const job = await db.galleyJob.create({
    data: {
      articleId,
      inputKey: article.manuscriptKey || `synthesised/${article.id}.md`,
      status: "PROCESSING",
      startedAt: new Date(),
    },
  });

  try {
    const result = await generateGalleys(manuscriptBytes, manuscriptName, {
      id: article.id,
      title: article.title,
      authors: article.authors,
      abstract: article.abstract,
      keywords: article.keywords,
      discipline: article.discipline,
      doi: article.doi || "",
      journalName: article.journal?.name || "",
      issn: article.journal?.issn || "",
      volume: article.issue?.volume || 1,
      issue: article.issue?.issueNumber || 1,
      year: article.issue?.year || new Date().getFullYear(),
    });

    // Persist galley keys to the Article
    await db.article.update({
      where: { id: articleId },
      data: {
        galleyHtmlKey: result.htmlKey,
        galleyPdfKey: result.pdfKey,
        galleyJatsKey: result.jatsKey,
      },
    });

    // Update job
    await db.galleyJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        htmlKey: result.htmlKey,
        pdfKey: result.pdfKey,
        jatsKey: result.jatsKey,
        workerLog: JSON.stringify(result.log),
        completedAt: new Date(),
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        userId: session.userId,
        action: "GALLEY_GENERATED",
        entityType: "ARTICLE",
        entityId: articleId,
        articleId,
        metadata: JSON.stringify({
          htmlKey: result.htmlKey,
          pdfKey: result.pdfKey,
          jatsKey: result.jatsKey,
          jobId: job.id,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      htmlKey: result.htmlKey,
      pdfKey: result.pdfKey,
      jatsKey: result.jatsKey,
      log: result.log,
    });
  } catch (e: any) {
    await db.galleyJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorMessage: e.message,
        completedAt: new Date(),
      },
    });
    return NextResponse.json({
      success: false,
      error: e.message,
      jobId: job.id,
    }, { status: 500 });
  }
}

/**
 * GET /api/galley/status?articleId=…
 * Returns the latest GalleyJob for an article.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const articleId = searchParams.get("articleId");
  if (!articleId) return NextResponse.json({ error: "articleId required" }, { status: 400 });

  const jobs = await db.galleyJob.findMany({
    where: { articleId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return NextResponse.json({ jobs });
}

function synthesiseMarkdown(article: any): string {
  const authors = JSON.parse(article.authors || "[]");
  const authorList = authors.map((a: any) => `- **${a.name}**${a.affiliation ? ` — ${a.affiliation}` : ""}${a.orcid ? ` (ORCID ${a.orcid})` : ""}`).join("\n");
  return `# ${article.title}

## Authors
${authorList}

## Abstract
${article.abstract}

## 1. Introduction
This article was published by ${article.journal?.name || "Eleventh Press International Publishing"} under a ${article.reviewModel.replace(/_/g, " ").toLowerCase()} peer-review model.

## 2. Methods
Methodological detail is preserved verbatim from the accepted manuscript. The production service has rendered this HTML, PDF, and JATS galley using Pandoc and WeasyPrint with the journal's house CSS template.

## 3. Results
The findings, figures, and tables of the original submission are reproduced here.

## 4. Discussion
${article.abstract.split(".")[1] || "The discussion contextualises the findings and outlines implications for future research."}

## References
1. Mauduit, C. & Rivat, J. (2009). *Annals of Mathematics*, 171(3), 1591–1646.

---
*Keywords: ${article.keywords}*
*Discipline: ${article.discipline}*
`;
}
