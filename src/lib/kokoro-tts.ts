/**
 * Kokoro-82M text-to-speech — turns a published Article/MagazinePiece/
 * MediaPost into a real, downloadable narration audio file. Runs the real,
 * free, open-weight Kokoro-82M model (Apache-2.0) locally via
 * @huggingface/transformers (through the kokoro-js wrapper) — no external
 * API, no per-request cost, same "run the real open model in-process, fail
 * open if it can't load" pattern as src/lib/embeddings.ts and
 * src/lib/transcription.ts.
 *
 * Unlike embeddings (which has a deterministic hash fallback), there is no
 * honest non-model fallback for "read this text aloud" — same reasoning as
 * transcription.ts: a failed job is a real FAILED status with a real
 * errorMessage, never a fabricated or silent audio file. The existing
 * browser-native speechSynthesis widget (src/components/article/
 * narration-player.tsx) already covers the zero-dependency case; this adds a
 * higher-quality, shareable, server-rendered alternative on top of it.
 *
 * Long content is capped (NARRATION_TEXT_CHAR_CAP) rather than narrated in
 * full — CPU inference of a full research paper could run long enough to
 * risk a serverless function timeout, and this job runs synchronously
 * within the triggering API request (same as MagazineIssueProductionJob).
 * The cap is disclosed in the stored job, never silently applied.
 */
import { db } from "@/lib/db";
import { getObject, putObject } from "@/lib/storage";

const MODEL_ID = process.env.KOKORO_MODEL || "onnx-community/Kokoro-82M-v1.0-ONNX";
const SAMPLE_GAP_SEC = 0.35;
const NARRATION_TEXT_CHAR_CAP = 12000;

export type NarrationContentType = "ARTICLE" | "MAGAZINE_PIECE" | "MEDIA_POST";

let ttsPromise: Promise<any | null> | null = null;

/** Lazily loads the local Kokoro pipeline once per warm instance. Resolves
 * null (never throws) if it can't load — same fail-open contract as every
 * other local-model loader in this codebase (see embeddings.ts, transcription.ts). */
function getTts(): Promise<any | null> {
  if (!ttsPromise) {
    ttsPromise = (async () => {
      try {
        const { KokoroTTS } = await import("kokoro-js");
        return await KokoroTTS.from_pretrained(MODEL_ID, { dtype: "q8", device: "cpu" });
      } catch (e) {
        console.error("[kokoro-tts] local Kokoro model failed to load:", e);
        return null;
      }
    })();
  }
  return ttsPromise;
}

/** Test-only: clears the cached model-load promise. */
export function __resetKokoroTtsCacheForTests(): void {
  ttsPromise = null;
}

/** Strips HTML tags/entities down to plain narratable text — same regex
 * approach already used client-side by narration-player.tsx. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fetches the title + narratable plain text for a content item. Returns
 * null if the item doesn't exist or isn't published — narration only ever
 * runs over final, public-facing text.
 */
async function getNarrationSource(
  contentType: NarrationContentType,
  contentId: string
): Promise<{ title: string; text: string } | null> {
  if (contentType === "ARTICLE") {
    const article = await db.article.findUnique({
      where: { id: contentId },
      select: { status: true, title: true, abstract: true, galleyHtmlKey: true },
    });
    if (!article || article.status !== "PUBLISHED") return null;
    let bodyText = "";
    if (article.galleyHtmlKey) {
      const buf = await getObject(article.galleyHtmlKey);
      if (buf) {
        const html = buf.toString("utf-8");
        const match = html.match(/<div class="article-body">([\s\S]*)<\/div>\s*<\/body>/);
        if (match) bodyText = htmlToPlainText(match[1]);
      }
    }
    const text = [article.abstract, bodyText].filter(Boolean).join(". ");
    return { title: article.title, text };
  }

  if (contentType === "MAGAZINE_PIECE") {
    const piece = await db.magazinePiece.findUnique({
      where: { id: contentId },
      select: { title: true, dek: true, bodyHtml: true, issue: { select: { status: true } } },
    });
    if (!piece || piece.issue.status !== "PUBLISHED") return null;
    const text = [piece.dek, htmlToPlainText(piece.bodyHtml)].filter(Boolean).join(". ");
    return { title: piece.title, text };
  }

  const post = await db.mediaPost.findUnique({
    where: { id: contentId },
    select: { status: true, title: true, dek: true, bodyHtml: true },
  });
  if (!post || post.status !== "PUBLISHED") return null;
  const text = [post.dek, htmlToPlainText(post.bodyHtml)].filter(Boolean).join(". ");
  return { title: post.title, text };
}

export interface SynthesizedNarration {
  wavBuffer: Buffer;
  durationSec: number;
  wordCount: number;
  model: string;
}

/**
 * Synthesizes `title. text` into a single WAV file, chunked sentence-by-
 * sentence via kokoro-js's streaming splitter (a single non-streaming
 * generate() call would truncate long input) and concatenated into one
 * buffer with a short silence gap between chunks.
 */
export async function synthesizeNarration(
  title: string,
  text: string,
  voice: string
): Promise<SynthesizedNarration | null> {
  const tts = await getTts();
  if (!tts) return null;

  const truncated = text.length > NARRATION_TEXT_CHAR_CAP;
  const body = truncated ? text.slice(0, NARRATION_TEXT_CHAR_CAP) : text;
  const fullText = [title, body, truncated ? "This narration covers an excerpt of the full piece." : null]
    .filter(Boolean)
    .join(". ");
  const wordCount = fullText.split(/\s+/).filter(Boolean).length;

  const { TextSplitterStream } = await import("kokoro-js");
  const splitter = new TextSplitterStream();
  const stream = tts.stream(splitter, { voice });

  const chunks: Float32Array[] = [];
  let samplingRate = 24000;
  const streamDone = (async () => {
    for await (const { audio } of stream) {
      samplingRate = audio.sampling_rate;
      chunks.push(audio.audio);
    }
  })();
  splitter.push(fullText);
  splitter.close();
  await streamDone;

  if (chunks.length === 0) return null;

  const gapSamples = Math.round(SAMPLE_GAP_SEC * samplingRate);
  const gap = new Float32Array(gapSamples);
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0) + gap.length * (chunks.length - 1);
  const combined = new Float32Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk, i) => {
    combined.set(chunk, offset);
    offset += chunk.length;
    if (i < chunks.length - 1) {
      combined.set(gap, offset);
      offset += gap.length;
    }
  });

  const { RawAudio } = await import("@huggingface/transformers");
  const rawAudio = new RawAudio(combined, samplingRate);
  const wavBuffer = Buffer.from(rawAudio.toWav());

  return { wavBuffer, durationSec: Math.round(combined.length / samplingRate), wordCount, model: MODEL_ID };
}

/** Runs a single NarrationJob to completion (or failure) — same atomic-claim
 * pattern as runTranscriptionJob/runMagazineIssueProductionJob. */
export async function runNarrationJob(jobId: string, claimFilter: Record<string, unknown> = {}): Promise<void> {
  const claimed = await db.narrationJob.updateMany({
    where: { id: jobId, ...claimFilter },
    data: { status: "PROCESSING", startedAt: new Date(), errorMessage: null },
  });
  if (claimed.count !== 1) return;

  const job = await db.narrationJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  try {
    const source = await getNarrationSource(job.contentType as NarrationContentType, job.contentId);
    if (!source) throw new Error("Content not found or not published");
    if (!source.text.trim()) throw new Error("Content has no narratable text");

    const result = await synthesizeNarration(source.title, source.text, job.voice);
    if (!result) throw new Error(`Local Kokoro TTS model (${MODEL_ID}) is not available in this deployment`);

    const key = `narration-audio/${job.contentType.toLowerCase()}/${job.contentId}.wav`;
    await putObject(key, result.wavBuffer, "audio/wav");

    await db.narrationJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        audioKey: key,
        durationSec: result.durationSec,
        wordCount: result.wordCount,
        model: result.model,
        completedAt: new Date(),
      },
    });

    await db.auditLog.create({
      data: {
        userId: job.createdById,
        action: "NARRATION_GENERATED",
        entityType: job.contentType,
        entityId: job.contentId,
        metadata: JSON.stringify({ jobId, durationSec: result.durationSec }),
      },
    });
  } catch (e: any) {
    await db.narrationJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: e.message, completedAt: new Date() },
    });
  }
}

/** Batch entry point for a future cron sweep — mirrors
 * sweepStuckTranscriptionJobs, currently unregistered in vercel.json for the
 * same Hobby-tier cron-count reason those are. */
export async function sweepStuckNarrationJobs(limit = 5, staleMinutes = 20): Promise<{ swept: number; jobIds: string[] }> {
  const staleCutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
  const stuck = await db.narrationJob.findMany({
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
    await runNarrationJob(job.id, {
      OR: [{ status: "QUEUED" }, { status: "PROCESSING", startedAt: { lt: staleCutoff } }],
    });
  }

  return { swept: stuck.length, jobIds: stuck.map((j) => j.id) };
}
