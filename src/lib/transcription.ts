/**
 * Qualitative-data transcription (Eleventh Research Lab) — transcribes a
 * researcher-uploaded WAV recording (interview, oral history, field
 * notes) using a real, free, open-source Whisper model
 * (Xenova/whisper-tiny.en via @xenova/transformers) running locally — no
 * external API, no per-request cost, same "run the real open model
 * in-process" pattern as src/lib/chunk-embeddings.ts and src/lib/
 * embeddings.ts.
 *
 * WAV decoding uses the `wavefile` package (MIT) to convert whatever bit
 * depth/sample rate/channel count the upload has into the mono 16kHz
 * float32 PCM Whisper expects.
 *
 * There is no sensible heuristic for "guess what audio says" — unlike
 * every chatJSON-backed feature in this codebase, a failed transcription
 * has no honest non-LLM fallback at all, so an unusable result is simply
 * a FAILED job with a real errorMessage, never a fabricated transcript.
 * Same atomic-claim/job-status pattern as AltTextJob/TableAccessibilityJob.
 */
import { db } from "@/lib/db";
import { getObject } from "@/lib/storage";

const WHISPER_MODEL_ID = process.env.WHISPER_MODEL || "Xenova/whisper-tiny.en";

let whisperPipelinePromise: Promise<any | null> | null = null;

/** Lazily loads the local Whisper pipeline once per warm instance.
 * Resolves null (never throws) if it can't load — same fail-open contract
 * as every other local-model loader in this codebase. */
function getWhisperPipeline(): Promise<any | null> {
  if (!whisperPipelinePromise) {
    whisperPipelinePromise = (async () => {
      try {
        const { pipeline } = await import("@xenova/transformers");
        return await pipeline("automatic-speech-recognition", WHISPER_MODEL_ID);
      } catch (e) {
        console.error("[transcription] local Whisper model failed to load:", e);
        return null;
      }
    })();
  }
  return whisperPipelinePromise;
}

/** Test-only: clears the cached model-load promise. */
export function __resetWhisperPipelineCacheForTests(): void {
  whisperPipelinePromise = null;
}

/**
 * Decodes arbitrary WAV bytes into mono 16kHz float32 PCM samples in
 * [-1, 1] — the input format transformers.js's ASR pipeline expects when
 * given a raw sample array instead of a URL.
 */
export async function decodeWavTo16kMono(bytes: Buffer): Promise<Float32Array> {
  const { WaveFile } = await import("wavefile");
  const wav = new WaveFile(bytes);
  wav.toBitDepth("32f");
  wav.toSampleRate(16000);
  // getSamples(false) de-interleaves: a mono file returns a single sample
  // array directly, a multi-channel file returns one array per channel —
  // wavefile's own .d.ts types this loosely as `Float64Array`, so the
  // runtime shape is checked defensively here rather than trusted.
  const raw = wav.getSamples(false) as unknown;
  const channels = Array.isArray(raw) ? (raw as ArrayLike<number>[]) : [raw as ArrayLike<number>];
  if (channels.length === 0 || channels[0].length === 0) {
    throw new Error("WAV file contains no audio samples");
  }
  if (channels.length === 1) {
    return Float32Array.from(channels[0]);
  }
  // Multi-channel: mix down to mono by averaging every channel per sample.
  const length = channels[0].length;
  const mono = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (const ch of channels) sum += ch[i] ?? 0;
    mono[i] = sum / channels.length;
  }
  return mono;
}

/**
 * Runs a single TranscriptionJob to completion (or failure) — same
 * atomic-claim pattern as runTableAccessibilityJob.
 */
export async function runTranscriptionJob(jobId: string, claimFilter: Record<string, unknown> = {}): Promise<void> {
  const claimed = await db.transcriptionJob.updateMany({
    where: { id: jobId, ...claimFilter },
    data: { status: "PROCESSING", startedAt: new Date(), errorMessage: null },
  });
  if (claimed.count !== 1) return;

  const job = await db.transcriptionJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  try {
    const audioBytes = await getObject(job.audioKey);
    if (!audioBytes) throw new Error("Uploaded audio file not found in storage");

    const samples = await decodeWavTo16kMono(audioBytes);

    const pipe = await getWhisperPipeline();
    if (!pipe) throw new Error(`Local transcription model (${WHISPER_MODEL_ID}) is not available in this deployment`);

    const output = await pipe(samples, { chunk_length_s: 30, stride_length_s: 5 });
    const text: string = (Array.isArray(output) ? output[0]?.text : output?.text)?.trim() ?? "";
    if (!text) throw new Error("Transcription produced no text — the audio may be silent or unintelligible");

    await db.transcriptionJob.update({
      where: { id: jobId },
      data: { status: "COMPLETED", transcript: text, model: WHISPER_MODEL_ID, completedAt: new Date() },
    });

    await db.auditLog.create({
      data: {
        userId: job.userId,
        action: "TRANSCRIPTION_GENERATED",
        entityType: "TRANSCRIPTION_JOB",
        entityId: job.id,
        metadata: JSON.stringify({ jobId, fileName: job.fileName }),
      },
    });
  } catch (e: any) {
    await db.transcriptionJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: e.message, completedAt: new Date() },
    });
  }
}

/** Batch entry point for a future cron sweep — mirrors
 * sweepStuckTableAccessibilityJobs, currently unregistered in vercel.json
 * for the same Hobby-tier cron-count reason that one is. */
export async function sweepStuckTranscriptionJobs(limit = 5, staleMinutes = 15): Promise<{ swept: number; jobIds: string[] }> {
  const staleCutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
  const stuck = await db.transcriptionJob.findMany({
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
    await runTranscriptionJob(job.id, {
      OR: [{ status: "QUEUED" }, { status: "PROCESSING", startedAt: { lt: staleCutoff } }],
    });
  }

  return { swept: stuck.length, jobIds: stuck.map((j) => j.id) };
}
