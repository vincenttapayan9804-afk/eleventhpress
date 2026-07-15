/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { isConfirmedArchived, lockssPermissionStatementText, PRESERVATION_PROVIDERS, PRESERVATION_STATUSES } from "@/lib/preservation";

describe("isConfirmedArchived", () => {
  test("true only for CONFIRMED_ARCHIVED", () => {
    expect(isConfirmedArchived("CONFIRMED_ARCHIVED")).toBe(true);
  });

  test("false for every other status, including ones that sound close", () => {
    for (const status of PRESERVATION_STATUSES) {
      if (status === "CONFIRMED_ARCHIVED") continue;
      expect(isConfirmedArchived(status)).toBe(false);
    }
    expect(isConfirmedArchived("HARVESTING_ENABLED")).toBe(false);
    expect(isConfirmedArchived("")).toBe(false);
  });
});

describe("lockssPermissionStatementText", () => {
  test("names the publisher, journal, and ISSN when present", () => {
    const text = lockssPermissionStatementText({
      name: "Eleventh Press Journal of Mathematics",
      issn: "2945-1138",
      publisher: "Eleventh Press International Publishing",
    });
    expect(text).toContain("Eleventh Press International Publishing");
    expect(text).toContain("Eleventh Press Journal of Mathematics");
    expect(text).toContain("ISSN 2945-1138");
    expect(text).toContain("LOCKSS system has permission");
  });

  test("omits the ISSN clause entirely when there isn't one, rather than printing a blank ISSN", () => {
    const text = lockssPermissionStatementText({
      name: "A New Journal",
      issn: null,
      publisher: "A Publisher",
    });
    expect(text).not.toContain("ISSN");
  });
});

describe("providers/statuses are the exact set the schema and API routes expect", () => {
  test("PRESERVATION_PROVIDERS", () => {
    const providers: string[] = [...PRESERVATION_PROVIDERS].sort();
    expect(providers).toEqual(["CLOCKSS", "PORTICO"]);
  });

  test("PRESERVATION_STATUSES", () => {
    const statuses: string[] = [...PRESERVATION_STATUSES].sort();
    expect(statuses).toEqual(
      ["AGREEMENT_PENDING", "CONFIRMED_ARCHIVED", "HARVESTING_ENABLED", "LAPSED", "NOT_STARTED"].sort()
    );
  });
});
