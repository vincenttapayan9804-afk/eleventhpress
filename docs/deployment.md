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

## Sessions, file uploads, and LLM triage also need real configuration now

Three more env vars matter beyond the database:

- **`SESSION_SECRET`** — required in production; the app throws at startup
  without it (`src/lib/auth.ts`). Sessions are signed JWTs now, not the
  original unsigned base64 mock. Generate one with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- **`BLOB_READ_WRITE_TOKEN`** — enables real manuscript uploads via Vercel
  Blob. Connect a Blob store the same way as Postgres (project → **Storage**
  tab → create a Blob store), and this is injected automatically. Without
  it, the upload flow falls back to a local-disk dev mode
  (`GET /api/storage/mode` reports which one is active) that does not work
  once deployed, since Vercel's serverless filesystem is read-only outside
  `/tmp`.
- **`ANTHROPIC_API_KEY`** — optional; enables real LLM-assisted editorial
  triage (`src/lib/llm.ts`, backed by the Anthropic Messages API) on every
  new submission. The original implementation called a dev-sandbox-only
  SDK (`z-ai-web-dev-sdk`) that has no working configuration outside that
  sandbox, so triage silently ran the heuristic fallback in every real
  deployment; it now calls the real API when this key is set, and still
  falls back to the same deterministic heuristic (keyword matching, no LLM
  call) when it isn't.

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

## Schema + seed data run automatically on every build

The `build` script (`package.json`) runs `prisma db push`, then
`scripts/build-maintenance.ts` (the seed plus the data backfills), before
`next build`.

`prisma db push` runs **without** `--accept-data-loss`: a schema change
that would drop a column, table or data (or add a unique constraint over
existing duplicates) stops the deploy instead of silently deleting data.
To make such a change deliberately, back up the database, run
`bun run db:push:accept-data-loss` against it yourself, then redeploy.

`scripts/build-maintenance.ts` runs each step in order and reports its
time. Recurring catch-ups (galley re-rendering, provenance seals, citation
metrics, retention purges) run on every deploy; one-time historical
backfills run once and are recorded in the `MaintenanceRun` table so later
deploys never re-apply them to new data. Only the seed is required — any
other failing step is logged and the deploy continues. Vercel's build environment has normal
internet access (unlike, say, a network-restricted sandbox trying to reach
the database directly), so this runs cleanly there with no manual step.
`scripts/seed.ts` checks for an existing `Journal` row first and exits
immediately if one's found, so re-running it on every subsequent redeploy
is a safe no-op rather than a duplicate insert or a crash.

One simplification worth knowing: preview and production deployments share
the same database (whatever's connected to the project), since this project
doesn't set up per-branch database provisioning (Neon supports branching
for that, if you want it later).

## Steps

1. **Provision Postgres.** Either:
   - In the Vercel dashboard, open the project → **Storage** tab → connect
     a Postgres database (e.g. the Neon marketplace integration). Whatever
     env var names it injects, set `POSTGRES_PRISMA_URL` (pooled) and
     `POSTGRES_URL_NON_POOLING` (direct) in the project's Environment
     Variables to point at the same values — those are the exact names
     `prisma/schema.prisma` reads.
   - Or use any other provider (Neon, Supabase, RDS, ...) directly and set
     those same two env vars yourself.
2. In the Vercel dashboard: **Add New → Project → Import Git Repository**,
   select this repo. Framework preset (Next.js) and root directory are
   auto-detected — no custom build/install commands needed.
3. Deploy (or redeploy, if the project already existed before the database
   was connected). The build creates the schema and loads starter data
   automatically — nothing else to run by hand.

## Optional sign-in methods

- **Passkeys** work out of the box (no configuration). Each passkey is
  bound to the domain it was created on, so tenants on their own domains
  get their own.
- **Sign in with Google** appears once `GOOGLE_CLIENT_ID` and
  `GOOGLE_CLIENT_SECRET` are set (Google Cloud Console → APIs & Services →
  Credentials → OAuth client ID, type "Web application"). Add
  `https://<your-domain>/api/auth/google/callback` as an authorised
  redirect URI for every domain in use. Accounts with two-step sign-in
  keep using their password or a passkey.
- **Signed-out devices** are refused on their next page load. With
  `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` set, they're also
  refused on every API call immediately.
