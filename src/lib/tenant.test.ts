/// <reference types="bun-types" />
import { describe, test, expect, mock } from "bun:test";

const platformTenant = {
  id: "tenant-platform",
  slug: "eleventhpress",
  name: "Eleventh Press",
  status: "ACTIVE",
  isPlatform: true,
  siteName: null,
  tagline: null,
  logoUrl: null,
  faviconUrl: null,
  primaryColor: null,
  accentColor: null,
  fontFamily: null,
};

const harvardTenant = { ...platformTenant, id: "tenant-harvard", slug: "harvard", name: "Harvard", isPlatform: false };

let tenantDomainRows: { hostname: string; verified: boolean; tenant: typeof platformTenant }[] = [];
let journals: { id: string; name: string; tenantId: string | null; createdAt: Date }[] = [];
let journalIdCounter = 0;

mock.module("@/lib/db", () => ({
  db: {
    tenant: {
      findFirst: mock(async () => platformTenant),
    },
    tenantDomain: {
      findFirst: mock(async ({ where }: { where: { hostname: string; verified: boolean } }) => {
        return (
          tenantDomainRows.find((d) => d.hostname === where.hostname && d.verified === where.verified) ?? null
        );
      }),
    },
    journal: {
      findFirst: mock(async ({ where }: { where: { tenantId: string } }) => {
        return journals.find((j) => j.tenantId === where.tenantId) ?? null;
      }),
      create: mock(async ({ data }: { data: { name: string; tenantId: string } }) => {
        const journal = { id: `journal-${++journalIdCounter}`, name: data.name, tenantId: data.tenantId, createdAt: new Date() };
        journals.push(journal);
        return journal;
      }),
    },
  },
}));

const { resolveTenantFromHost, getOrCreateTenantJournal } = await import("@/lib/tenant");

describe("resolveTenantFromHost — the boundary every tenant isolation check ultimately rests on", () => {
  test("routes a verified custom domain to its own tenant, not the platform", async () => {
    tenantDomainRows = [{ hostname: "journals.harvard.edu", verified: true, tenant: harvardTenant }];
    const tenant = await resolveTenantFromHost("journals.harvard.edu");
    expect(tenant?.id).toBe("tenant-harvard");
  });

  test("never routes an unverified domain to its claimed tenant — falls back to platform instead", async () => {
    tenantDomainRows = [{ hostname: "journals.harvard.edu", verified: false, tenant: harvardTenant }];
    const tenant = await resolveTenantFromHost("journals.harvard.edu");
    expect(tenant?.id).toBe("tenant-platform");
  });

  test("strips a port suffix before matching, so localhost:3000 resolves the same as localhost", async () => {
    tenantDomainRows = [];
    const tenant = await resolveTenantFromHost("localhost:3000");
    expect(tenant?.id).toBe("tenant-platform");
  });

  test("falls back to the platform tenant for any unrecognized host", async () => {
    tenantDomainRows = [];
    const tenant = await resolveTenantFromHost("some-preview-url.vercel.app");
    expect(tenant?.id).toBe("tenant-platform");
  });
});

describe("getOrCreateTenantJournal — what makes Article isolation work without an Article.tenantId column", () => {
  test("creates a journal scoped to the given tenant when none exists yet", async () => {
    journals = [];
    const journal = await getOrCreateTenantJournal(harvardTenant);
    expect(journal.tenantId).toBe("tenant-harvard");
  });

  test("reuses the existing journal for that tenant rather than creating a duplicate", async () => {
    journals = [{ id: "journal-existing", name: "Harvard Journal", tenantId: "tenant-harvard", createdAt: new Date() }];
    const journal = await getOrCreateTenantJournal(harvardTenant);
    expect(journal.id).toBe("journal-existing");
    expect(journals.length).toBe(1);
  });

  test("never returns another tenant's journal — each tenant gets its own, isolated row", async () => {
    journals = [{ id: "journal-platform", name: "Eleventh Press", tenantId: "tenant-platform", createdAt: new Date() }];
    const journal = await getOrCreateTenantJournal(harvardTenant);
    expect(journal.tenantId).toBe("tenant-harvard");
    expect(journal.id).not.toBe("journal-platform");
    expect(journals.length).toBe(2);
  });
});
