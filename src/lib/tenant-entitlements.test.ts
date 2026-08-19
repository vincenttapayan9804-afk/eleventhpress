/// <reference types="bun-types" />
import { describe, test, expect, mock } from "bun:test";

interface EntitlementRow {
  tenantId: string;
  moduleKey: string;
  enabled: boolean;
}

let rows: EntitlementRow[] = [];
const upserted: any[] = [];
const deletedFor: string[] = [];

mock.module("@/lib/db", () => ({
  db: {
    tenantEntitlement: {
      findUnique: mock(async ({ where: { tenantId_moduleKey } }: any) =>
        rows.find((r) => r.tenantId === tenantId_moduleKey.tenantId && r.moduleKey === tenantId_moduleKey.moduleKey) ?? null
      ),
      findMany: mock(async ({ where }: any) => rows.filter((r) => r.tenantId === where.tenantId)),
      upsert: mock(async ({ where, create, update }: any) => {
        upserted.push({ where, create, update });
        const existing = rows.find(
          (r) => r.tenantId === where.tenantId_moduleKey.tenantId && r.moduleKey === where.tenantId_moduleKey.moduleKey
        );
        if (existing) {
          existing.enabled = update.enabled;
        } else {
          rows.push({ tenantId: create.tenantId, moduleKey: create.moduleKey, enabled: create.enabled });
        }
      }),
      deleteMany: mock(async ({ where }: any) => {
        deletedFor.push(where.tenantId);
        rows = rows.filter((r) => r.tenantId !== where.tenantId);
      }),
    },
    $transaction: mock(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

const { hasModuleEntitlement, getTenantEntitlements, syncTenantEntitlements } = await import("@/lib/tenant-entitlements");
const { ALL_MODULE_KEYS, MODULE_KEYS } = await import("@/lib/tenant-plans");

describe("hasModuleEntitlement", () => {
  test("allows a request with no resolved tenant at all", async () => {
    expect(await hasModuleEntitlement(null, MODULE_KEYS.BENCHMARKING)).toBe(true);
    expect(await hasModuleEntitlement(undefined, MODULE_KEYS.BENCHMARKING)).toBe(true);
  });

  test("a module with no row is entitled by default (zero behavior change for pre-existing tenants)", async () => {
    rows = [];
    expect(await hasModuleEntitlement("tenant-1", MODULE_KEYS.BENCHMARKING)).toBe(true);
  });

  test("an explicit enabled:false row blocks that module only", async () => {
    rows = [{ tenantId: "tenant-1", moduleKey: MODULE_KEYS.BENCHMARKING, enabled: false }];
    expect(await hasModuleEntitlement("tenant-1", MODULE_KEYS.BENCHMARKING)).toBe(false);
    // A sibling module with no row of its own stays entitled even though
    // this tenant now has one row — entitlement is checked per module,
    // not "does this tenant have any rows at all."
    expect(await hasModuleEntitlement("tenant-1", MODULE_KEYS.BOARD_INTELLIGENCE)).toBe(true);
  });

  test("an explicit enabled:true row is entitled", async () => {
    rows = [{ tenantId: "tenant-1", moduleKey: MODULE_KEYS.BENCHMARKING, enabled: true }];
    expect(await hasModuleEntitlement("tenant-1", MODULE_KEYS.BENCHMARKING)).toBe(true);
  });

  test("rows are tenant-scoped — another tenant's row never leaks across", async () => {
    rows = [{ tenantId: "tenant-1", moduleKey: MODULE_KEYS.BENCHMARKING, enabled: false }];
    expect(await hasModuleEntitlement("tenant-2", MODULE_KEYS.BENCHMARKING)).toBe(true);
  });
});

describe("getTenantEntitlements", () => {
  test("every module defaults to true with zero rows", async () => {
    rows = [];
    const result = await getTenantEntitlements("tenant-1");
    for (const key of ALL_MODULE_KEYS) expect(result[key]).toBe(true);
  });

  test("reflects explicit rows, leaves the rest true", async () => {
    rows = [{ tenantId: "tenant-1", moduleKey: MODULE_KEYS.RESEARCH_BOARD_INTELLIGENCE, enabled: false }];
    const result = await getTenantEntitlements("tenant-1");
    expect(result[MODULE_KEYS.RESEARCH_BOARD_INTELLIGENCE]).toBe(false);
    expect(result[MODULE_KEYS.BENCHMARKING]).toBe(true);
  });
});

describe("syncTenantEntitlements", () => {
  test("clearing the plan (null) deletes all rows for that tenant", async () => {
    rows = [{ tenantId: "tenant-1", moduleKey: MODULE_KEYS.BENCHMARKING, enabled: true }];
    await syncTenantEntitlements("tenant-1", null);
    expect(deletedFor).toContain("tenant-1");
    expect(rows.filter((r) => r.tenantId === "tenant-1")).toHaveLength(0);
  });

  test("assigning UNIVERSITY_SMALL enables only its default modules", async () => {
    rows = [];
    await syncTenantEntitlements("tenant-1", "UNIVERSITY_SMALL");
    const result = await getTenantEntitlements("tenant-1");
    expect(result[MODULE_KEYS.DEPARTMENTS]).toBe(true);
    expect(result[MODULE_KEYS.RESEARCH_LAB]).toBe(true);
    expect(result[MODULE_KEYS.BENCHMARKING]).toBe(false);
    expect(result[MODULE_KEYS.BOARD_INTELLIGENCE]).toBe(false);
  });

  test("assigning UNIVERSITY_LARGE enables every module", async () => {
    rows = [];
    await syncTenantEntitlements("tenant-1", "UNIVERSITY_LARGE");
    const result = await getTenantEntitlements("tenant-1");
    for (const key of ALL_MODULE_KEYS) expect(result[key]).toBe(true);
  });

  test("an unknown plan key enables nothing rather than throwing", async () => {
    rows = [];
    await syncTenantEntitlements("tenant-1", "NOT_A_REAL_PLAN");
    const result = await getTenantEntitlements("tenant-1");
    for (const key of ALL_MODULE_KEYS) expect(result[key]).toBe(false);
  });
});
