import { describe, test, expect } from "bun:test";
import { cleanScope, corpusArticleWhere, coverageOf, describeScope, sanitizeSettingsInput } from "./research-assistant-settings";
import { tenantRowFilter } from "./research-assistant-admin";

describe("cleanScope", () => {
  test("keeps valid disciplines, years, issue and article ids", () => {
    expect(
      cleanScope({ disciplines: ["Education", " Education ", "", 4], yearFrom: "2024", yearTo: 2022, issueId: "iss_1", articleIds: ["a1", "a1", "bad id!"] })
    ).toEqual({ disciplines: ["Education"], yearFrom: 2022, yearTo: 2024, issueId: "iss_1", articleIds: ["a1"] });
  });
  test("nothing that narrows the search is no scope", () => {
    expect(cleanScope({})).toBeNull();
    expect(cleanScope({ yearFrom: 1200, issueId: "x y" })).toBeNull();
    expect(cleanScope("everything")).toBeNull();
  });
});

describe("corpusArticleWhere", () => {
  test("always the institution's own published articles", () => {
    expect(corpusArticleWhere("ten_1", null)).toEqual({ status: "PUBLISHED", journal: { tenantId: "ten_1" } });
  });
  test("narrowed by the reader's scope", () => {
    const w = corpusArticleWhere("ten_1", { disciplines: ["Biology"], yearFrom: 2022, yearTo: 2023, issueId: "i1", articleIds: ["a"] }) as any;
    expect(w.discipline).toEqual({ in: ["Biology"] });
    expect(w.publishedAt.gte.toISOString()).toBe("2022-01-01T00:00:00.000Z");
    expect(w.publishedAt.lt.toISOString()).toBe("2024-01-01T00:00:00.000Z");
    expect(w.issueId).toBe("i1");
    expect(w.id).toEqual({ in: ["a"] });
    expect(w.journal).toEqual({ tenantId: "ten_1" });
  });
});

describe("describeScope", () => {
  test("reads naturally", () => {
    expect(describeScope({ disciplines: ["Education"], yearFrom: 2022, yearTo: 2024 })).toBe("Education; published 2022–2024");
    expect(describeScope({ articleIds: ["a"] }, { articleTitles: ["Coastal Adaptation"] })).toBe('"Coastal Adaptation"');
    expect(describeScope({ yearFrom: 2025, yearTo: 2025 })).toBe("published in 2025");
    expect(describeScope(null)).toBe("");
  });
});

describe("coverageOf", () => {
  test("grades how much evidence an answer stands on", () => {
    expect(coverageOf({ grounded: false, citedArticles: 0, citations: 0, evidenceStatus: "unsupported" })).toBe("none");
    expect(coverageOf({ grounded: true, citedArticles: 3, citations: 6, evidenceStatus: "verified" })).toBe("strong");
    expect(coverageOf({ grounded: true, citedArticles: 1, citations: 2, evidenceStatus: "verified" })).toBe("partial");
    expect(coverageOf({ grounded: true, citedArticles: 1, citations: 1, evidenceStatus: "verified" })).toBe("limited");
    expect(coverageOf({ grounded: true, citedArticles: 2, citations: 1, evidenceStatus: "review" })).toBe("limited");
  });
});

describe("sanitizeSettingsInput", () => {
  test("clamps limits, trims text and resets with null", () => {
    expect(
      sanitizeSettingsInput({
        enabled: false,
        disclaimer: "  Study   support only. ",
        signedInHourlyLimit: 99999,
        anonymousHourlyLimit: 0,
        retentionDays: null,
        starterQuestions: [" What is new? ", "", 3],
        unknown: "ignored",
      })
    ).toEqual({
      enabled: false,
      disclaimer: "Study support only.",
      signedInHourlyLimit: 2000,
      anonymousHourlyLimit: 1,
      retentionDays: null,
      starterQuestions: JSON.stringify(["What is new?"]),
    });
  });
});

describe("tenantRowFilter", () => {
  test("an institution sees its own rows; the platform also sees rows saved before institutions were recorded", () => {
    expect(tenantRowFilter({ tenantId: "ten_1", all: false, platformTenantId: "plat" })).toEqual({ tenantId: "ten_1" });
    expect(tenantRowFilter({ tenantId: "plat", all: false, platformTenantId: "plat" })).toEqual({ OR: [{ tenantId: "plat" }, { tenantId: null }] });
    expect(tenantRowFilter({ tenantId: null, all: true, platformTenantId: "plat" })).toEqual({});
  });
});
