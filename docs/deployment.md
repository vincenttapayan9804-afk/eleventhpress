# Deploying to Vercel

## Database: real Postgres, not the bundled SQLite demo

`prisma/schema.prisma` targets Postgres (`POSTGRES_PRISMA_URL` for the
pooled connection, `POSTGRES_URL_NON_POOLING` for migrations — see
`.env.example`). This gives the deployed app a real, persistent database:
registering, submitting a manuscript, editorial decisions, reviews — all of
it actually sticks, unlike an earlier iteration of this deployment that
bundled a read-only SQLite snapshot as a stopgap (Vercel's serverless
filesystem is read-only outside `/tmp`, and `/tmp` isn't persistent or
shared across instances, so SQLite never was a real option there).

## What still doesn't run on Vercel

- **Production galley generation (Pandoc/WeasyPrint) and the realtime
  WebSocket dashboard** — both need a long-lived process, which serverless
  functions aren't. The app already degrades gracefully here (placeholder
  galleys, no live updates) rather than crashing. If you want these for
  real, run `mini-services/pandoc-worker` and `mini-services/ws-service` on
  something that stays running — Cloud Run, Fly.io, a small VPS — and point
  `src/lib/galley.ts` / `src/lib/ws-client.ts` at them.
- **LLM editorial triage / semantic search** fall back to their
  deterministic heuristic/hash-based implementations outside the original
  sandbox they were built in — unaffected by where the app is hosted.

## Steps

1. **Provision Postgres.** Either:
   - In the Vercel dashboard, open the project → **Storage** tab → connect
     a Postgres database. Vercel injects `POSTGRES_PRISMA_URL` and
     `POSTGRES_URL_NON_POOLING` into the project automatically — nothing to
     copy or type.
   - Or use any other provider (Neon, Supabase, RDS, ...) and set those two
     env vars yourself in the Vercel project settings.
2. **Create the schema and load starter data**, once, against that database:
   ```
   POSTGRES_PRISMA_URL=... POSTGRES_URL_NON_POOLING=... bun run db:push
   POSTGRES_PRISMA_URL=... POSTGRES_URL_NON_POOLING=... bun run scripts/seed.ts
   ```
3. In the Vercel dashboard: **Add New → Project → Import Git Repository**,
   select this repo. Framework preset (Next.js) and root directory are
   auto-detected — no custom build/install commands needed.
4. Deploy.
