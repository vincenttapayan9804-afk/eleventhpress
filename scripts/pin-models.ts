/**
 * Pins a downloaded model: records the SHA-256 of every file in models.lock.json.
 *
 *   bun scripts/pin-models.ts <modelId> <folder holding the model's files> [source note]
 *
 * Run it on a machine you trust, right after the model first downloads, and
 * commit the lock file. From then on the platform refuses a model whose files differ.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { hashDirectory, loadLock } from "../src/lib/model-integrity";

async function main() {
  const [modelId, dir, source] = process.argv.slice(2);
  if (!modelId || !dir) {
    console.error("Usage: bun scripts/pin-models.ts <modelId> <folder> [source note]");
    process.exit(2);
  }
  const files = await hashDirectory(dir);
  if (Object.keys(files).length === 0) {
    console.error(`No files found in ${dir}. Nothing pinned.`);
    process.exit(1);
  }
  const path = join(process.cwd(), "models.lock.json");
  const lock = loadLock(path);
  lock.models[modelId] = { source, pinnedAt: new Date().toISOString().slice(0, 10), files };
  writeFileSync(path, JSON.stringify(lock, null, 2) + "\n");
  console.log(`Pinned ${Object.keys(files).length} files for ${modelId} in models.lock.json`);
}
main();
