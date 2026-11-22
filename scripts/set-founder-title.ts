/**
 * One-off: shows Vincent Tapayan as "Founder" on the public Editorial
 * Board instead of the role-based "Editor-in-Chief" label. Display only:
 * his account role and permissions are unchanged.
 *
 * Fails (so the next deploy retries) if no matching account is found, or
 * if more than one matches, rather than guessing.
 *
 * Usage:
 *   bun run scripts/set-founder-title.ts
 */
import { db } from "../src/lib/db";

const TITLE = "Founder";

async function main() {
  const matches = await db.user.findMany({
    where: { role: "SUPER_ADMIN", fullName: { contains: "Tapayan", mode: "insensitive" } },
    select: { id: true, fullName: true },
  });
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one SUPER_ADMIN named Tapayan, found ${matches.length}; nothing changed.`);
  }
  await db.user.update({ where: { id: matches[0].id }, data: { boardTitle: TITLE } });
  console.log(`Board title for ${matches[0].fullName} set to "${TITLE}".`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
