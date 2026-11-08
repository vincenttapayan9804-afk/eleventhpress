import { describe, expect, test } from "bun:test";
import { articleIdFromSegment, articlePath, DASHBOARD_TABS, pathForState, sameRoute, stateForPath, slugify } from "./spa-routes";

describe("spa routes", () => {
  test("static views round-trip", () => {
    for (const view of ["home", "browse", "books", "about", "faqs", "magazines", "adminPortal", "login"] as const) {
      const path = pathForState({ view })!;
      expect(stateForPath(path)?.view).toBe(view);
    }
  });

  test("every dashboard tab has its own path", () => {
    for (const tab of DASHBOARD_TABS) {
      if (tab === "reviewerForm") continue;
      const path = pathForState({ view: "dashboard", dashboardTab: tab })!;
      expect(stateForPath(path)).toEqual({ view: "dashboard", dashboardTab: tab });
    }
    expect(pathForState({ view: "dashboard", dashboardTab: "myArticles" })).toBe("/dashboard/my-articles");
    expect(pathForState({ view: "dashboard", dashboardTab: "overview" })).toBe("/dashboard");
  });

  test("reviewer form keeps its review id", () => {
    const path = pathForState({ view: "dashboard", dashboardTab: "reviewerForm", reviewId: "rev1" })!;
    expect(stateForPath(path)).toEqual({ view: "dashboard", dashboardTab: "reviewerForm", reviewId: "rev1" });
  });

  test("parameterised views", () => {
    expect(stateForPath("/magazines/abc")).toEqual({ view: "magazineIssue", magazineIssueId: "abc" });
    expect(stateForPath("/media/p1")).toEqual({ view: "mediaPost", mediaPostId: "p1" });
    expect(stateForPath("/departments/physics")).toEqual({ view: "department", departmentSlug: "physics" });
    expect(stateForPath("/resources", "?tab=blogs")).toEqual({ view: "resources", resourcesTab: "blogs" });
    expect(stateForPath("/resources", "?tab=evil")).toEqual({ view: "resources", resourcesTab: "trainings" });
  });

  test("readable article paths carry the id", () => {
    const path = articlePath("clx8abc", "Climate Adaptation in Ásia: A Review");
    expect(path).toBe("/article/climate-adaptation-in-asia-a-review--clx8abc");
    expect(stateForPath(path)).toEqual({ view: "article", articleId: "clx8abc" });
    expect(articleIdFromSegment("clx8abc")).toBe("clx8abc");
    expect(articleIdFromSegment("some-title--seed-article-1")).toBe("seed-article-1");
    expect(sameRoute(stateForPath(path)!, { view: "article", articleId: "clx8abc" })).toBe(true);
  });

  test("unknown paths are not pages", () => {
    for (const p of ["/nope", "/dashboard/not-a-tab", "/about/extra", "/dashboard/reviewer-form"]) {
      expect(stateForPath(p)).toBeNull();
    }
  });

  test("slugify", () => {
    expect(slugify("  Hello,  World!  ")).toBe("hello-world");
    expect(slugify("x".repeat(200)).length).toBeLessThanOrEqual(80);
  });
});
