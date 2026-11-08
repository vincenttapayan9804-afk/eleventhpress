import { describe, expect, test } from "bun:test";
import { trDashboard } from "./dashboard-i18n";
import { TABS } from "../components/dashboard/dashboard-tabs";

describe("dashboard navigation translations", () => {
  const texts = [...new Set([...TABS.map((t) => t.label), ...TABS.map((t) => t.group), "Pinned"])];
  for (const locale of ["es", "fr", "fil", "zh-Hans"] as const) {
    test(`every section and group has a ${locale} name`, () => {
      const missing = texts.filter((t) => trDashboard(t, locale) === t && !/^(COUNTER 5 \/ SUSHI|Eleventh Research Lab|Home|Profile|Second Brain|Subscription|Branding|Podcasts|Magazines|Narration|Branding & profile)$/.test(t));
      expect(missing).toEqual([]);
    });
  }
  test("English is unchanged", () => {
    expect(trDashboard("Overview", "en")).toBe("Overview");
  });
});
