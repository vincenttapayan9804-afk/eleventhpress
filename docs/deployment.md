# Deploying to Vercel

## What works, and what doesn't

EPIP was built to run as a single Node.js process with a local SQLite file
and local-disk "S3" storage. Vercel's serverless functions have neither: the
filesystem is read-only except `/tmp`, and `/tmp` is wiped between cold
starts and not shared across concurrent instances. Two changes make the app
boot and serve real content there anyway, with one honest limitation:

- **Reads work.** `src/lib/db.ts` detects `process.env.VERCEL` (set
  automatically by the platform) and, on cold start, copies a bundled,
  pre-seeded SQLite snapshot (`prisma/seed.db`) into `/tmp` before Prisma
  connects. Browsing articles, the OJS/Crossref/OAI-PMH export endpoints,
  and every other read path serve real seeded data.
- **Writes don't persist.** Registering a new account, submitting a
  manuscript, submitting a review — these will appear to succeed within
  that one request, but the next request may hit a different serverless
  instance with its own fresh copy of the seed data. This is not a bug to
  work around; it's what "no persistent database" means. Don't rely on this
  deployment for anything you need to keep.
- **Production galley generation (Pandoc/WeasyPrint) and the realtime
  WebSocket dashboard don't run at all** — both need a long-lived process,
  which serverless functions aren't. The app already degrades gracefully
  here (placeholder galleys, no live updates) rather than crashing.
- **LLM editorial triage / semantic search** already fall back to their
  deterministic heuristic/hash-based implementations outside the original
  sandbox — unchanged by deploying to Vercel.

## To get a real, persistent deployment

Swap the datasource in `prisma/schema.prisma` from `sqlite` to `postgresql`,
point `DATABASE_URL` at a real hosted Postgres instance (Vercel Postgres/Neon,
Supabase, RDS, etc.), and run `prisma migrate deploy` against it once. At
that point `src/lib/db.ts`'s Vercel-specific bootstrap block can be deleted
entirely — it exists only to make an otherwise-database-less deployment work
for demo purposes.

## Steps

1. In the Vercel dashboard: **Add New → Project → Import Git Repository**,
   and select this repo.
2. Leave the framework preset on **Next.js** (auto-detected) and the root
   directory as `/` — no custom build/install commands needed.
3. Deploy. No environment variables are required for the read-only demo
   mode described above.
