import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SDG_ATTRIBUTION, SDG_GOALS } from "@/lib/sdg";
import { SDG_STATEMENTS, SDG_UN_DISCLAIMER } from "@/lib/sdg-statements";
import { pathForState, stateForPath, VIEW_META, SITEMAP_PATHS } from "@/lib/spa-routes";
import { GlobalImpactContent, SdgGoalExplorer } from "./global-impact-view";

describe("Sustainable Development & Global Impact page", () => {
  test("has its own address, title and sitemap entry", () => {
    expect(pathForState({ view: "globalImpact" })).toBe("/sustainable-development");
    expect(stateForPath("/sustainable-development")?.view).toBe("globalImpact");
    expect(VIEW_META.globalImpact?.title).toBe("Sustainable Development & Global Impact");
    expect(SITEMAP_PATHS).toContain("/sustainable-development");
  });

  test("Eleventh Press: declaration, goals, Compact, initiatives and the corrected UN notice", () => {
    const html = renderToStaticMarkup(<GlobalImpactContent />);
    expect(html).toContain("Sustainable Development &amp; Global Impact");
    expect(html).toContain("Institutional declaration of support");
    expect(html).toContain(SDG_ATTRIBUTION);
    expect(html).toContain("SDG Publishers Compact");
    expect(html).toContain("has applied to join the SDG Publishers Compact");
    expect(html).not.toContain(">Signatory<");
    expect(html).toContain("Global missions &amp; initiatives");
    expect(html).toContain(SDG_UN_DISCLAIMER);
    expect(html).not.toContain("has not been approved by the United Nations");
    expect(html).not.toContain("global-impact-hosted");
  });

  test("tenant journal: same page, naming the journal as running on Eleventh Press infrastructure", () => {
    const html = renderToStaticMarkup(<GlobalImpactContent hostedJournal="Journal of Island Studies" />);
    expect(html).toContain("Journal of Island Studies is published on the Eleventh Press International Publishing™ infrastructure");
    expect(html).toContain("SDG Publishers Compact");
  });

  test("every goal has an official statement and a clickable icon", () => {
    for (const g of SDG_GOALS) expect(SDG_STATEMENTS[g.number]?.statement.length).toBeGreaterThan(100);
    const html = renderToStaticMarkup(<SdgGoalExplorer />);
    for (const g of SDG_GOALS) expect(html).toContain(`data-testid="sdg-goal-${g.number}"`);
    expect(html).not.toContain('data-testid="sdg-statement-panel"');
  });

  test("a selected goal reveals its statement", () => {
    const html = renderToStaticMarkup(<SdgGoalExplorer initialGoal={13} />);
    expect(html).toContain("Goal 13: Climate Action");
    expect(html).toContain(SDG_STATEMENTS[13].statement);
    expect(html).toContain('aria-expanded="true"');
  });
});
