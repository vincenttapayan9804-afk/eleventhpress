import os from "node:os";
import path from "node:path";

/**
 * Loads @xenova/transformers configured for the environment it runs in.
 *
 * transformers.js downloads model weights on first use and caches them in
 * a directory inside its own package by default. On serverless hosts
 * (Vercel, AWS Lambda) that directory is on a read-only file system, so
 * the cache goes to the writable temp directory instead. Weights are then
 * fetched once per warm instance.
 *
 * The native ONNX runtime the package needs (libonnxruntime.so) is shipped
 * with the functions that embed text via next.config.ts's
 * outputFileTracingIncludes; without it the import fails and callers fall
 * back to hashed embeddings.
 */
export async function loadTransformers(): Promise<typeof import("@xenova/transformers")> {
  const transformers = await import("@xenova/transformers");
  if (isServerless()) {
    transformers.env.cacheDir = path.join(os.tmpdir(), "transformers-cache");
  }
  return transformers;
}

function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}
