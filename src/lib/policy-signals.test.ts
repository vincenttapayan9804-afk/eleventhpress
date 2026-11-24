import { describe, expect, test } from "bun:test";
import { policySignals } from "./policy-signals";
import { POLICY_SLUGS } from "./policy-pages";

describe("policy signals", () => {
  const s = policySignals("https://x.test");
  test("point at real policy pages on the site's own origin", () => {
    for (const u of [s.publishingPrinciples, s.correctionsPolicy, s.ethicsPolicy, s.ownershipFundingInfo]) {
      expect(u.startsWith("https://x.test/")).toBe(true);
    }
    for (const part of s.hasPart) {
      const m = part.url.match(/\/policies\/([\w-]+)$/);
      if (m) expect((POLICY_SLUGS as readonly string[]).includes(m[1])).toBe(true);
    }
  });
});

import { mediaBylineName, mediaStoryListItem, MEDIA_STORIES } from "./media/stories";
describe("newsroom byline", () => {
  test("news is bylined to the Eleventh Press Newsroom, blogs to the Editorial Office", () => {
    expect(mediaBylineName("NEWS")).toBe("Eleventh Press Newsroom");
    const news = MEDIA_STORIES.find((s) => s.type === "NEWS")!;
    expect(mediaStoryListItem(news).authorName).toBe("Eleventh Press Newsroom");
  });
});
