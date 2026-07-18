/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { ALL_ROLES, PRIVILEGED_ROLES, PRIVILEGED_ROLES_LIST, SELF_SELECTABLE_ROLES, APPLICATION_ROLES } from "@/lib/roles";

describe("roles", () => {
  test("ALL_ROLES has no duplicates", () => {
    expect(new Set(ALL_ROLES).size).toBe(ALL_ROLES.length);
  });

  test("PRIVILEGED_ROLES_LIST is a subset of ALL_ROLES", () => {
    for (const role of PRIVILEGED_ROLES_LIST) {
      expect((ALL_ROLES as readonly string[]).includes(role)).toBe(true);
    }
  });

  test("PRIVILEGED_ROLES (Set) matches PRIVILEGED_ROLES_LIST exactly", () => {
    expect(PRIVILEGED_ROLES.size).toBe(PRIVILEGED_ROLES_LIST.length);
    for (const role of PRIVILEGED_ROLES_LIST) {
      expect(PRIVILEGED_ROLES.has(role)).toBe(true);
    }
  });

  test("SELF_SELECTABLE_ROLES and APPLICATION_ROLES are subsets of ALL_ROLES and don't overlap", () => {
    for (const role of [...SELF_SELECTABLE_ROLES, ...APPLICATION_ROLES]) {
      expect((ALL_ROLES as readonly string[]).includes(role)).toBe(true);
    }
    const overlap = SELF_SELECTABLE_ROLES.filter((r) => (APPLICATION_ROLES as readonly string[]).includes(r));
    expect(overlap.length).toBe(0);
  });
});
