import { describe, expect, test } from "bun:test";
import { OPEN_ACCESS_RESOURCE_LINKS, policyPages } from "./policy-pages";

describe("open access resource links", () => {
  test("every link is https, has a label and a description", () => {
    for (const l of OPEN_ACCESS_RESOURCE_LINKS) {
      expect(l.href.startsWith("https://")).toBe(true);
      expect(l.label.length).toBeGreaterThan(2);
      expect(l.note.length).toBeGreaterThan(20);
    }
  });

  test("the section is on the open access page with a no-endorsement note", () => {
    const page = policyPages("Test Journal", "ed@example.org")["open-access"];
    const section = page.sections.find((s) => s.heading === "Open access initiatives and resources");
    expect(section).toBeDefined();
    const text = JSON.stringify(section);
    expect(text).toContain("does not mean they endorse or are affiliated");
    expect(text).not.toContain("Eleventh Press");
  });

  test("tenant name flows through and the links are identical for every tenant", () => {
    const a = policyPages("Alpha Review", "a@example.org")["open-access"];
    const b = policyPages("Beta Review", "b@example.org")["open-access"];
    const links = (p: typeof a) => p.sections.find((s) => s.heading.startsWith("Open access initiatives"))!.blocks.filter((x) => x.kind === "links");
    expect(links(a)).toEqual(links(b));
  });
});
