/** Re-seed the database (wipes all data first). */
import { db } from "../src/lib/db";
import { main as seedMain } from "./seed";

async function main() {
  console.log("Wiping existing data...");
  await db.auditLog.deleteMany();
  await db.notification.deleteMany();
  await db.invoice.deleteMany();
  await db.subscription.deleteMany();
  await db.editorialDecision.deleteMany();
  await db.review.deleteMany();
  await db.article.deleteMany();
  await db.issue.deleteMany();
  await db.journal.deleteMany();
  await db.user.deleteMany();
  console.log("Wiped. Re-running seed...");
  await seedMain();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
