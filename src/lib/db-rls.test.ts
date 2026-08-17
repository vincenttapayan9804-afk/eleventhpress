/// <reference types="bun-types" />
import { describe, test, expect, mock } from "bun:test";
import type { SessionPayload } from "@/lib/auth";

let executeRawCalls: unknown[][] = [];
const fakeTx = {
  $executeRaw: mock((strings: TemplateStringsArray, ...values: unknown[]) => {
    executeRawCalls.push(values);
    return Promise.resolve(1);
  }),
};

mock.module("@/lib/db", () => ({
  db: {
    $transaction: mock(async (fn: (tx: unknown) => unknown) => fn(fakeTx)),
  },
}));

const { withRlsContext, withTenantRlsContext } = await import("@/lib/db-rls");

function session(overrides: Partial<SessionPayload> = {}): SessionPayload {
  return { userId: "user-1", email: "jane@example.edu", role: "AUTHOR", fullName: "Jane Doe", ...overrides };
}

describe("withRlsContext", () => {
  test("sets app.user_id, app.role, and app.tenant_id as query parameters before running fn", async () => {
    executeRawCalls = [];
    await withRlsContext(session({ userId: "user-42", role: "EDITOR", tenantId: "tenant-1" }), async (tx) => {
      expect(tx).toBe(fakeTx as never);
      return "done";
    });
    expect(executeRawCalls.length).toBe(1);
    expect(executeRawCalls[0]).toEqual(["user-42", "EDITOR", "tenant-1"]);
  });

  test("sets app.tenant_id to an empty string for a session with no tenantId", async () => {
    executeRawCalls = [];
    await withRlsContext(session({ tenantId: undefined }), async () => "done");
    expect(executeRawCalls[0]).toEqual(["user-1", "AUTHOR", ""]);
  });

  test("returns fn's result", async () => {
    const result = await withRlsContext(session(), async () => ({ ok: true }));
    expect(result).toEqual({ ok: true });
  });

  test("propagates errors from fn without swallowing them", async () => {
    await expect(
      withRlsContext(session(), async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
  });
});

describe("withTenantRlsContext", () => {
  test("sets app.role to PUBLIC and app.tenant_id, with no session required", async () => {
    executeRawCalls = [];
    await withTenantRlsContext("tenant-9", async (tx) => {
      expect(tx).toBe(fakeTx as never);
      return "done";
    });
    expect(executeRawCalls[0]).toEqual(["tenant-9"]);
  });

  test("sets app.tenant_id to an empty string for a null/undefined tenant", async () => {
    executeRawCalls = [];
    await withTenantRlsContext(null, async () => "done");
    expect(executeRawCalls[0]).toEqual([""]);
  });

  test("returns fn's result", async () => {
    const result = await withTenantRlsContext("tenant-1", async () => ({ ok: true }));
    expect(result).toEqual({ ok: true });
  });
});
