import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SDG_ATTRIBUTION } from "@/lib/sdg";
import { GlobalImpactSection } from "./global-impact-section";

describe("GlobalImpactSection", () => {
  test("Eleventh Press: shows the SDGs, attribution and Compact, with no hosted-journal line", () => {
    const html = renderToStaticMarkup(<GlobalImpactSection />);
    expect(html).toContain("Sustainable Development &amp; Global Impact");
    expect(html).toContain(SDG_ATTRIBUTION);
    expect(html).toContain("SDG Publishers Compact");
    expect(html).not.toContain("global-impact-hosted");
  });

  test("tenant journal: same section, naming the journal as running on Eleventh Press infrastructure", () => {
    const html = renderToStaticMarkup(<GlobalImpactSection hostedJournal="Journal of Island Studies" />);
    expect(html).toContain("Journal of Island Studies is published on the Eleventh Press International Publishing™ infrastructure");
    expect(html).toContain(SDG_ATTRIBUTION);
    expect(html).toContain("SDG Publishers Compact");
  });
});
