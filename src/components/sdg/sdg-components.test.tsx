import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { suggestSdgs } from "@/lib/sdg";
import { SdgGoalPicker } from "./sdg-goal-picker";
import { SdgConfirmPanel, SdgStatusChip } from "./sdg-confirm-panel";
import { sdgReviewItems } from "./sdg-review-list";

const climate = {
  id: "a1",
  title: "Climate change adaptation in coastal cities",
  abstract: "We study greenhouse gas emissions and climate resilience.",
  keywords: "climate change, carbon emissions",
  discipline: "Environmental Science",
};

describe("SdgGoalPicker", () => {
  test("shows all 17 goals, marks selected and suggested ones, and locks the rest at three", () => {
    const html = renderToStaticMarkup(
      <SdgGoalPicker value={[1, 2, 13]} onChange={() => {}} suggestions={suggestSdgs(climate)} />
    );
    for (let n = 1; n <= 17; n++) expect(html).toContain(`data-testid="sdg-chip-${n}"`);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(3);
    expect(html).toContain("3 of 3 selected");
    expect(html).toContain("Suggested");
    // Unselected goals are disabled once three are chosen.
    expect(html.match(/disabled=""/g)?.length).toBe(14);
  });
});

describe("SdgConfirmPanel", () => {
  test("an author's proposal is shown as pending, pre-selected", () => {
    const html = renderToStaticMarkup(
      <SdgConfirmPanel article={{ ...climate, sdgGoals: "[13]", sdgStatus: "PROPOSED" }} />
    );
    expect(html).toContain("Pending confirmation: SDG 13");
    expect(html).toContain("The author proposed these goals");
    expect(html).toContain("Confirm goals");
  });

  test("with no proposal, the local suggestions are pre-selected", () => {
    const html = renderToStaticMarkup(<SdgConfirmPanel article={{ ...climate, sdgStatus: "NONE" }} />);
    expect(html).toContain("No goals proposed");
    expect(html).toContain('data-testid="sdg-a1-chip-13" aria-pressed="true"');
  });

  test("status chip wording", () => {
    expect(renderToStaticMarkup(<SdgStatusChip status="CONFIRMED" goals={[]} />)).toContain("Confirmed: no goal applies");
    expect(renderToStaticMarkup(<SdgStatusChip status="CONFIRMED" goals={[4, 10]} />)).toContain("Confirmed: SDG 4 · SDG 10");
  });
});

describe("sdgReviewItems", () => {
  test("lists only published articles without confirmed goals", () => {
    const items = sdgReviewItems([
      { id: "1", status: "PUBLISHED", sdgStatus: "NONE" },
      { id: "2", status: "PUBLISHED", sdgStatus: "PROPOSED" },
      { id: "3", status: "PUBLISHED", sdgStatus: "CONFIRMED" },
      { id: "4", status: "UNDER_REVIEW", sdgStatus: "NONE" },
    ]);
    expect(items.map((a) => a.id)).toEqual(["1", "2"]);
  });
});
