/// <reference types="bun-types" />
import { describe, test, expect, mock } from "bun:test";

mock.module("@/lib/db", () => ({ db: {} }));
mock.module("@/lib/db-rls", () => ({ withTenantRlsContext: async () => [] }));

const { identityLevel, summarizeChecks, IDENTITY_LABEL } = await import("./author-profile");
const { displayCase } = await import("./author-path");

describe("displayCase", () => {
  test("title-cases names and job titles typed in capitals", () => {
    expect(displayCase("VINCENT MARFE TAPAYAN")).toBe("Vincent Marfe Tapayan");
    expect(displayCase("PROFESSIONAL NEUROPLASTICIAN")).toBe("Professional Neuroplastician");
    expect(displayCase("MARIA DELA CRUZ-SANTOS")).toBe("Maria dela Cruz-Santos");
    expect(displayCase("JOHN O'NEIL III")).toBe("John O'Neil III");
  });
  test("leaves the author's own styling and short acronyms alone", () => {
    expect(displayCase("Vincent van Gogh")).toBe("Vincent van Gogh");
    expect(displayCase("bell hooks")).toBe("bell hooks");
    expect(displayCase("STCAST")).toBe("STCAST");
    expect(displayCase(null)).toBe("");
  });
});

describe("identityLevel", () => {
  const orcid = "0000-0002-1825-0097";
  test("an account that signed in with the same ORCID iD is authenticated", () => {
    expect(identityLevel(orcid, { orcid, orcidLastSync: new Date(), emailVerifiedAt: null })).toBe("orcid-authenticated");
    expect(identityLevel(orcid, { orcid: `https://orcid.org/${orcid.toLowerCase()}`, orcidLastSync: new Date() })).toBe("orcid-authenticated");
  });
  test("an ORCID typed on a profile but never signed in with is not", () => {
    expect(identityLevel(orcid, { orcid, orcidLastSync: null, emailVerifiedAt: null })).toBe("account");
    expect(identityLevel(orcid, { orcid: "0000-0001-0000-0000", orcidLastSync: new Date(), emailVerifiedAt: new Date() })).toBe("verified-account");
  });
  test("no account means a listed author", () => {
    expect(identityLevel(orcid, null)).toBe("listed");
    expect(IDENTITY_LABEL.listed.badge).toBe("Listed author");
  });
});

describe("summarizeChecks", () => {
  test("counts sealed, DOI and confirmed publications", () => {
    expect(
      summarizeChecks([
        { sealed: true, doi: "10.5072/x", authorship: "submitting" },
        { sealed: true, doi: null, authorship: null },
        { sealed: false, doi: "10.5072/y", authorship: "confirmed" },
      ])
    ).toEqual({ sealed: 2, withDoi: 2, authorshipConfirmed: 2, total: 3 });
  });
});
