/**
 * Checks downloaded model files against models.lock.json.
 *
 *   bun scripts/verify-models.ts <modelId> <folder holding the model's files>
 *
 * Exit 0: matches, or the model is not pinned yet (said plainly). Exit 1: mismatch.
 */
import { loadLock, verifyModel } from "../src/lib/model-integrity";

async function main() {
  const [modelId, dir] = process.argv.slice(2);
  if (!modelId || !dir) {
    console.error("Usage: bun scripts/verify-models.ts <modelId> <folder>");
    process.exit(2);
  }
  const res = await verifyModel(dir, loadLock().models[modelId]);
  if (res.status === "not-pinned") console.log(`${modelId} is NOT pinned. Run scripts/pin-models.ts to pin it.`);
  else if (res.status === "ok") console.log(`${modelId}: all ${res.files} files match their pinned checksums.`);
  else {
    console.error(`${modelId}: MISMATCH. Changed: ${res.changed.join(", ") || "none"}. Missing: ${res.missing.join(", ") || "none"}.`);
    process.exit(1);
  }
}
main();
