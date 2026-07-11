import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
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
