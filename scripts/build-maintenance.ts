/**
 * Runs the database maintenance steps of a deploy, in order, after
 * `prisma db push` and before `next build` (package.json "build").
 *
 * - "every" steps are idempotent catch-ups that run on each deploy
 *   (re-rendering stale galleys, resealing provenance, refreshing citation
 *   metrics, retention purges).
 * - "once" steps are historical backfills. They run a single time and are
 *   then recorded in MaintenanceRun, so a later deploy can't re-apply them
 *   to new data: before this, every deploy marked all unverified accounts
 *   as verified and re-enabled Review History on articles an editor had
 *   switched it off for. `alreadyApplied` marks steps that every earlier
 *   deploy already ran, so they are recorded without running again.
 *
 * Only the seed is required; any other failing step is logged and the
 * deploy continues, as before.
 */
import { spawnSync } from "node:child_process";
import { db } from "../src/lib/db";

type Step = { script: string; args?: string[]; mode: "every" | "once"; required?: boolean; alreadyApplied?: boolean };

const STEPS: Step[] = [
  { script: "seed.ts", mode: "every", required: true },
  { script: "apply-password-reset.ts", mode: "every" },
  { script: "backfill-platform-tenant.ts", args: ["--confirm"], mode: "every" },
  { script: "backfill-audit-tenant.ts", args: ["--confirm"], mode: "once", alreadyApplied: true },
  { script: "backfill-galleys.ts", args: ["--confirm"], mode: "every" },
  { script: "backfill-provenance.ts", args: ["--confirm"], mode: "every" },
  { script: "backfill-email-verified.ts", args: ["--confirm"], mode: "once", alreadyApplied: true },
  { script: "refresh-citation-metrics.ts", args: ["--confirm"], mode: "every" },
  { script: "enable-review-history.ts", mode: "once", alreadyApplied: true },
  { script: "purge-old-ip-addresses.ts", mode: "every" },
  { script: "purge-research-conversations.ts", mode: "every" },
];

async function done(name: string) {
  return !!(await db.maintenanceRun.findUnique({ where: { name } }));
}

async function record(name: string) {
  await db.maintenanceRun.upsert({ where: { name }, create: { name }, update: {} });
}

async function main() {
  const started = Date.now();
  for (const step of STEPS) {
    const name = step.script.replace(/\.ts$/, "");
    if (step.mode === "once") {
      if (await done(name)) {
        console.log(`[maintenance] ${name}: already applied, skipped`);
        continue;
      }
      if (step.alreadyApplied) {
        await record(name);
        console.log(`[maintenance] ${name}: applied by earlier deploys, recorded without running`);
        continue;
      }
    }
    const t = Date.now();
    const result = spawnSync("bun", ["run", `scripts/${step.script}`, ...(step.args ?? [])], { stdio: "inherit" });
    const secs = ((Date.now() - t) / 1000).toFixed(1);
    if (result.status === 0) {
      console.log(`[maintenance] ${name}: ok (${secs}s)`);
      if (step.mode === "once") await record(name);
    } else if (step.required) {
      console.error(`[maintenance] ${name}: FAILED (${secs}s) — stopping the deploy`);
      process.exit(1);
    } else {
      console.warn(`[maintenance] ${name}: failed (${secs}s), continuing`);
    }
  }
  console.log(`[maintenance] finished in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
