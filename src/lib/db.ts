import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Vercel's serverless functions have a read-only filesystem except /tmp,
 * and /tmp isn't persistent or shared across instances — there's no way to
 * run `prisma db push` + seed ahead of time from this repo alone, and any
 * writes made from one invocation won't be visible to the next. Rather than
 * crash on every query against a database that was never created, copy a
 * bundled, pre-seeded SQLite snapshot (prisma/seed.db) into /tmp on cold
 * start and point Prisma at that.
 *
 * This makes the deployed app work for reading — browsing articles, the
 * OJS/Crossref/OAI-PMH export endpoints, etc. — but writes (registering,
 * submitting, logging a review) will appear to succeed within that single
 * request/instance and then be gone; they are not a substitute for a real
 * database. See docs/deployment.md.
 */
if (process.env.VERCEL) {
  const runtimeDb = '/tmp/epip-runtime.db'
  if (!fs.existsSync(runtimeDb)) {
    const seedDb = path.join(process.cwd(), 'prisma', 'seed.db')
    if (fs.existsSync(seedDb)) {
      fs.copyFileSync(seedDb, runtimeDb)
    }
  }
  process.env.DATABASE_URL = `file:${runtimeDb}`
}

// Force a fresh client if the schema version has changed (cache-busting)
const SCHEMA_VERSION = "v2-openreview-crossref";
const cachedVersion = (globalForPrisma as any).__epipSchemaVersion;
if (cachedVersion !== SCHEMA_VERSION) {
  if (globalForPrisma.prisma) {
    try { globalForPrisma.prisma.$disconnect(); } catch {}
  }
  globalForPrisma.prisma = undefined;
  (globalForPrisma as any).__epipSchemaVersion = SCHEMA_VERSION;
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['warn', 'error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db