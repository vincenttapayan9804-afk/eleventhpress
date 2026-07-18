import { PrismaClient } from '@prisma/client'
import { encryptUserFields, decryptUserFields } from './field-encryption'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Force a fresh client if the schema version has changed (cache-busting)
const SCHEMA_VERSION = "v6-field-encryption";
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

const rawClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['warn', 'error'],
    datasourceUrl: pooledDatasourceUrl(),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = rawClient

/**
 * Field-level encryption for User's OAuth token columns
 * (src/lib/field-encryption.ts) — transparent to every existing call
 * site: reads decrypt, writes encrypt, and rows written before this
 * feature shipped keep reading back as plaintext unchanged. Applied via
 * a Prisma Client Extension rather than touching each of the ~6 call
 * sites that read/write these fields individually, so no route code
 * needed to change.
 */
export const db = rawClient.$extends({
  name: 'field-encryption',
  query: {
    user: {
      async create({ args, query }) {
        encryptUserFields(args.data)
        return decryptUserFields(await query(args))
      },
      async update({ args, query }) {
        encryptUserFields(args.data)
        return decryptUserFields(await query(args))
      },
      async updateMany({ args, query }) {
        encryptUserFields(args.data)
        return query(args)
      },
      async findUnique({ args, query }) {
        return decryptUserFields(await query(args))
      },
      async findFirst({ args, query }) {
        return decryptUserFields(await query(args))
      },
      async findMany({ args, query }) {
        const results = await query(args)
        return results.map((r) => decryptUserFields(r))
      },
    },
  },
})
