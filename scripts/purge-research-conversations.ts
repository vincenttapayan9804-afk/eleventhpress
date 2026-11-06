/**
 * Retention for the AI Research Assistant (src/lib/research-assistant.ts):
 * deletes saved conversations with no activity for
 * RESEARCH_CHAT_RETENTION_DAYS (default 365) and answer feedback older
 * than RESEARCH_FEEDBACK_RETENTION_DAYS (default 730).
 *
 * Idempotent. Runs on every production build (package.json's "build"
 * script) and daily via /api/cron/sweep-all.
 *
 * Usage:
 *   bun run scripts/purge-research-conversations.ts
 */
import { purgeExpiredResearchData } from "../src/lib/research-assistant";

purgeExpiredResearchData()
  .then((r) => {
    console.log(`Research Assistant retention: deleted ${r.conversations} conversation(s) and ${r.feedback} feedback record(s).`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
