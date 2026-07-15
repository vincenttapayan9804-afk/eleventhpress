/**
 * AI-generated figure alt text (src/lib/llm.ts's describeImage), for
 * accessibility compliance. Figures live inline as <img> tags inside the
 * galley HTML blob — no first-class Figure model exists in this codebase
 * — so this parses them out with plain regex (no DOM-parsing library is
 * a dependency of this project, and a full HTML parser isn't warranted
 * for extracting one tag shape with two attributes) rather than
 * introducing one.
 *
 * A generated suggestion is never auto-applied: runAltTextJob() only
 * stores results for editor review; a separate applyAltTextResults() call
 * commits reviewed alt text into the live galley HTML. This mirrors the
 * platform's broader rule that unreviewed LLM output never silently
 * overwrites a production artifact.
 */
import { db } from "@/lib/db";
import { getObject, putObject } from "@/lib/storage";
import { describeImage } from "@/lib/llm";
import sharp from "sharp";

export interface ExtractedImage {
  src: string;
  existingAlt: string;
}

export interface AltTextSuggestion {
  src: string;
  existingAlt: string;
  suggestedAlt: string;
  mode: "llm" | "heuristic";
}

const IMG_TAG_PATTERN = /<img\b[^>]*>/gi;
const SRC_PATTERN = /\bsrc\s*=\s*["']([^"']*)["']/i;
const ALT_PATTERN = /\balt\s*=\s*["']([^"']*)["']/i;

/** Pulls every <img> tag's src/alt out of a galley HTML string. */
export function extractImgTags(html: string): ExtractedImage[] {
  const matches = html.match(IMG_TAG_PATTERN) || [];
  return matches
    .map((tag) => ({
      src: tag.match(SRC_PATTERN)?.[1] ?? "",
      existingAlt: tag.match(ALT_PATTERN)?.[1] ?? "",
    }))
    .filter((img) => !!img.src);
}

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/**
 * Rewrites the `alt` attribute of every <img> tag whose `src` matches one
 * of `updates`, leaving every other tag/attribute untouched.
 */
export function applyAltText(html: string, updates: { src: string; altText: string }[]): string {
  let result = html;
  for (const { src, altText } of updates) {
    const tagPattern = new RegExp(`<img\\b([^>]*\\bsrc\\s*=\\s*["']${escapeForRegex(src)}["'][^>]*)>`, "i");
    result = result.replace(tagPattern, (_full, attrs: string) => {
      const withoutAlt = attrs.replace(/\s*\balt\s*=\s*["'][^"']*["']/i, "");
      return `<img${withoutAlt} alt="${escapeHtmlAttr(altText)}">`;
    });
  }
  return result;
}

async function fetchImageBytes(src: string): Promise<Buffer | null> {
  if (/^https?:\/\//i.test(src)) {
    try {
      const res = await fetch(src);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }
  return getObject(src);
}

const SHARP_FORMAT_TO_MEDIA_TYPE: Record<string, "image/png" | "image/jpeg" | "image/webp" | "image/gif"> = {
  png: "image/png",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

function heuristicAltText(existingAlt: string, articleTitle: string): string {
  return existingAlt.trim() || `Figure from ${articleTitle}`;
}

/**
 * Runs a single AltTextJob to completion (or failure) — same atomic-claim
 * pattern as runGalleyJob (src/lib/galley-job.ts). Generates one
 * suggestion per figure found in the article's galley HTML; never writes
 * to the galley itself (see applyAltTextResults for that).
 */
export async function runAltTextJob(
  jobId: string,
  triggeredBy: string | null = null,
  claimFilter: Record<string, unknown> = {}
): Promise<void> {
  const claimed = await db.altTextJob.updateMany({
    where: { id: jobId, ...claimFilter },
    data: { status: "PROCESSING", startedAt: new Date(), errorMessage: null },
  });
  if (claimed.count !== 1) return;

  const job = await db.altTextJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const article = await db.article.findUnique({ where: { id: job.articleId } });
  if (!article) {
    await db.altTextJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: "Article no longer exists", completedAt: new Date() },
    });
    return;
  }

  try {
    const galleyHtml = article.galleyHtmlKey ? await getObject(article.galleyHtmlKey) : null;
    if (!galleyHtml) throw new Error("Article has no galley HTML to scan for figures");

    const images = extractImgTags(galleyHtml.toString("utf-8"));
    const suggestions: AltTextSuggestion[] = [];

    for (const image of images) {
      const bytes = await fetchImageBytes(image.src);
      if (!bytes) {
        suggestions.push({ ...image, suggestedAlt: heuristicAltText(image.existingAlt, article.title), mode: "heuristic" });
        continue;
      }

      try {
        const resized = await sharp(bytes).resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).toBuffer();
        const meta = await sharp(resized).metadata();
        const mediaType = meta.format ? SHARP_FORMAT_TO_MEDIA_TYPE[meta.format] : undefined;
        if (!mediaType) throw new Error(`Unsupported image format: ${meta.format}`);

        const promptContext = image.existingAlt
          ? `This figure appears in an article titled "${article.title}". Its existing caption reads: "${image.existingAlt}". Write alt text for it.`
          : `This figure appears in an article titled "${article.title}". Write alt text for it.`;

        const { altText, model } = await describeImage(resized.toString("base64"), mediaType, promptContext);
        suggestions.push({ ...image, suggestedAlt: altText, mode: "llm" });
        void model;
      } catch {
        suggestions.push({ ...image, suggestedAlt: heuristicAltText(image.existingAlt, article.title), mode: "heuristic" });
      }
    }

    await db.altTextJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        imagesFound: images.length,
        imagesProcessed: suggestions.length,
        results: JSON.stringify(suggestions),
        completedAt: new Date(),
      },
    });

    await db.auditLog.create({
      data: {
        userId: triggeredBy,
        action: "ALT_TEXT_GENERATED",
        entityType: "ARTICLE",
        entityId: article.id,
        articleId: article.id,
        metadata: JSON.stringify({ jobId, imagesFound: images.length, trigger: triggeredBy ? "manual" : "system" }),
      },
    });
  } catch (e: any) {
    await db.altTextJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: e.message, completedAt: new Date() },
    });
  }
}

/**
 * Commits editor-reviewed alt text into the live galley HTML — the only
 * path that ever changes what's actually served. Re-fetches the current
 * galley HTML rather than trusting the job's stale snapshot, in case the
 * galley was regenerated since the job ran.
 */
export async function applyAltTextResults(
  articleId: string,
  jobId: string,
  reviewedResults: { src: string; altText: string }[]
): Promise<void> {
  const article = await db.article.findUnique({ where: { id: articleId } });
  if (!article?.galleyHtmlKey) throw new Error("Article has no galley HTML");

  const galleyHtml = await getObject(article.galleyHtmlKey);
  if (!galleyHtml) throw new Error("Galley HTML not found in storage");

  const updated = applyAltText(galleyHtml.toString("utf-8"), reviewedResults);
  await putObject(article.galleyHtmlKey, Buffer.from(updated, "utf-8"), "text/html");

  await db.altTextJob.update({ where: { id: jobId }, data: { appliedAt: new Date() } });
}

/** Batch entry point for the cron sweep — mirrors sweepStuckGalleyJobs. */
export async function sweepStuckAltTextJobs(limit = 5, staleMinutes = 10): Promise<{ swept: number; jobIds: string[] }> {
  const staleCutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
  const stuck = await db.altTextJob.findMany({
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
    await runAltTextJob(job.id, null, {
      OR: [{ status: "QUEUED" }, { status: "PROCESSING", startedAt: { lt: staleCutoff } }],
    });
  }

  return { swept: stuck.length, jobIds: stuck.map((j) => j.id) };
}
