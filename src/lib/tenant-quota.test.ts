/// <reference types="bun-types" />
import { describe, test, expect, mock } from "bun:test";

let tenantRow: { maxUsers: number | null } | null = null;
let userCount = 0;

mock.module("@/lib/db", () => ({
  db: {
    tenant: { findUnique: mock(async () => tenantRow) },
    user: { count: mock(async () => userCount) },
  },
}));

const { tenantHasUserCapacity } = await import("@/lib/tenant-quota");

describe("tenantHasUserCapacity", () => {
  test("allows a request with no resolved tenant at all", async () => {
    expect(await tenantHasUserCapacity(null)).toBe(true);
    expect(await tenantHasUserCapacity(undefined)).toBe(true);
  });

  test("allows an unlimited (maxUsers: null) tenant regardless of how many users it has", async () => {
    tenantRow = { maxUsers: null };
    userCount = 10_000;
    expect(await tenantHasUserCapacity("tenant-1")).toBe(true);
  });

  test("allows a tenant under its cap", async () => {
    tenantRow = { maxUsers: 5 };
    userCount = 4;
    expect(await tenantHasUserCapacity("tenant-1")).toBe(true);
  });

  test("blocks a tenant exactly at its cap", async () => {
    tenantRow = { maxUsers: 5 };
    userCount = 5;
    expect(await tenantHasUserCapacity("tenant-1")).toBe(false);
  });

  test("blocks a tenant over its cap", async () => {
    tenantRow = { maxUsers: 5 };
    userCount = 9;
    expect(await tenantHasUserCapacity("tenant-1")).toBe(false);
  });

  test("allows a tenantId that no longer resolves to a row (fails open, matching resolveTenantFromHost's own fallback posture)", async () => {
    tenantRow = null;
    expect(await tenantHasUserCapacity("tenant-deleted")).toBe(true);
  });
});
