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

const { withRlsContext } = await import("@/lib/db-rls");

function session(overrides: Partial<SessionPayload> = {}): SessionPayload {
  return { userId: "user-1", email: "jane@example.edu", role: "AUTHOR", fullName: "Jane Doe", ...overrides };
}

describe("withRlsContext", () => {
  test("sets app.user_id and app.role as query parameters before running fn", async () => {
    executeRawCalls = [];
    await withRlsContext(session({ userId: "user-42", role: "EDITOR" }), async (tx) => {
      expect(tx).toBe(fakeTx as never);
      return "done";
    });
    expect(executeRawCalls.length).toBe(1);
    expect(executeRawCalls[0]).toEqual(["user-42", "EDITOR"]);
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
