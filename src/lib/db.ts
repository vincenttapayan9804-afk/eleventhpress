import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Force a fresh client if the schema version has changed (cache-busting)
const SCHEMA_VERSION = "v3-scale-indexes";
const cachedVersion = (globalForPrisma as any).__epipSchemaVersion;
if (cachedVersion !== SCHEMA_VERSION) {
  if (globalForPrisma.prisma) {
    try { globalForPrisma.prisma.$disconnect(); } catch {}
  }
  globalForPrisma.prisma = undefined;
  (globalForPrisma as any).__epipSchemaVersion = SCHEMA_VERSION;
}

// Without an explicit connection_limit, Prisma defaults to
// num_physical_cpus * 2 + 1 connections PER PrismaClient instance. On
// Vercel, every concurrent serverless invocation gets its own instance (and
// thus its own pool), so under real concurrency this multiplies fast and
// exhausts Postgres — that's the root cause behind
// "Timed out fetching a new connection from the connection pool" seen in
// production. Capping each instance to a small pool relies on
// POSTGRES_PRISMA_URL already being Vercel's pooled (PgBouncer-backed)
// connection string, not the direct one — the pooler is what makes many
// small per-instance pools safe to fan out from many function instances.
function pooledDatasourceUrl(): string | undefined {
  const base = process.env.POSTGRES_PRISMA_URL;
  if (!base) return undefined;
  const url = new URL(base);
  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", process.env.PRISMA_CONNECTION_LIMIT || "3");
  }
  if (!url.searchParams.has("pool_timeout")) {
    url.searchParams.set("pool_timeout", "10");
  }
  return url.toString();
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['warn', 'error'],
    datasourceUrl: pooledDatasourceUrl(),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
