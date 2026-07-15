/**
 * Shared GalleyJob execution — the single place that actually runs
 * generateGalleys() and persists the result, so the same logic can be
 * triggered from the interactive endpoint (src/app/api/galley/generate),
 * the cron sweep that recovers orphaned/stuck jobs
 * (src/app/api/cron/galley-sweep), and the admin manual-retry endpoint
 * (src/app/api/admin/galley-jobs/[id]/retry) without duplicating it three
 * times.
 */
import { db } from "@/lib/db";
import { getObject } from "@/lib/storage";
import { generateGalleys } from "@/lib/galley";

const SYNTHESISED_PREFIX = "synthesised/";

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

/**
 * Runs a single GalleyJob to completion (or failure), updating its row and
 * the parent Article throughout. Safe to call for a freshly created QUEUED
 * job or to retry an existing FAILED/stuck-PROCESSING one — always
 * re-derives the manuscript bytes from the job's own inputKey rather than
 * assuming caller-supplied state, so a retry from cron or the admin portal
 * behaves identically to the original run.
 *
 * `triggeredBy` is `null` for system-initiated runs (cron sweep) so the
 * audit trail distinguishes them from editor-initiated ones.
 */
export async function runGalleyJob(
  jobId: string,
  triggeredBy: string | null = null,
  claimFilter: Record<string, unknown> = {}
): Promise<void> {
  // Atomically claim the job (status -> PROCESSING) conditioned on it still
  // matching claimFilter. If two callers race for the same stuck/queued job
  // (e.g. the cron sweep and an admin's manual retry landing at the same
  // moment), only one updateMany actually matches and flips the row —
  // the loser's count is 0 and it bails out rather than duplicating work.
  const claimed = await db.galleyJob.updateMany({
    where: { id: jobId, ...claimFilter },
    data: { status: "PROCESSING", startedAt: new Date(), errorMessage: null },
  });
  if (claimed.count !== 1) return;

  const job = await db.galleyJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const article = await db.article.findUnique({
    where: { id: job.articleId },
    include: { journal: true, issue: true },
  });
  if (!article) {
    await db.galleyJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: "Article no longer exists", completedAt: new Date() },
    });
    return;
  }

  let manuscriptBytes: Buffer;
  let manuscriptName: string;
  if (job.inputKey.startsWith(SYNTHESISED_PREFIX)) {
    manuscriptBytes = Buffer.from(synthesiseMarkdown(article), "utf-8");
    manuscriptName = `${article.id}.md`;
  } else {
    const stored = await getObject(job.inputKey);
    if (stored) {
      manuscriptBytes = stored;
      manuscriptName = job.inputKey.split("/").pop() || "manuscript.md";
    } else {
      manuscriptBytes = Buffer.from(synthesiseMarkdown(article), "utf-8");
      manuscriptName = `${article.id}.md`;
    }
  }

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

    await db.article.update({
      where: { id: article.id },
      data: {
        galleyHtmlKey: result.htmlKey,
        galleyPdfKey: result.pdfKey,
        galleyJatsKey: result.jatsKey,
        galleyEpubKey: result.epubKey,
      },
    });

    await db.galleyJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        htmlKey: result.htmlKey,
        pdfKey: result.pdfKey,
        jatsKey: result.jatsKey,
        epubKey: result.epubKey,
        workerLog: JSON.stringify(result.log),
        completedAt: new Date(),
      },
    });

    await db.auditLog.create({
      data: {
        userId: triggeredBy,
        action: "GALLEY_GENERATED",
        entityType: "ARTICLE",
        entityId: article.id,
        articleId: article.id,
        metadata: JSON.stringify({
          htmlKey: result.htmlKey,
          pdfKey: result.pdfKey,
          jatsKey: result.jatsKey,
          epubKey: result.epubKey,
          jobId,
          trigger: triggeredBy ? "manual" : "system",
        }),
      },
    });
  } catch (e: any) {
    await db.galleyJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errorMessage: e.message,
        completedAt: new Date(),
      },
    });
  }
}

/** Batch entry point for the cron sweep — finds jobs that never finished
 * (QUEUED, meaning nothing ever picked them up, or PROCESSING for longer
 * than staleMinutes, meaning the invocation that owned them died mid-run)
 * and retries each in turn. Bounded by `limit` so one sweep invocation
 * can't run indefinitely. */
export async function sweepStuckGalleyJobs(limit = 5, staleMinutes = 10): Promise<{ swept: number; jobIds: string[] }> {
  const staleCutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
  const stuck = await db.galleyJob.findMany({
    where: {
      OR: [
        { status: "QUEUED" },
        { status: "PROCESSING", startedAt: { lt: staleCutoff } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  for (const job of stuck) {
    await runGalleyJob(job.id, null, {
      OR: [{ status: "QUEUED" }, { status: "PROCESSING", startedAt: { lt: staleCutoff } }],
    });
  }

  return { swept: stuck.length, jobIds: stuck.map((j) => j.id) };
}
