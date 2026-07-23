/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { buildPodcastPackage, getPodcastPlatform, PODCAST_PLATFORMS } from "@/lib/podcast-distribution";

const PODCAST = {
  id: "podcast-1",
  title: "Corpus Callosum",
  description: "Conversations with researchers about work in progress.",
  category: "Science & Medicine",
  hosts: JSON.stringify([{ name: "Grace Hopper" }, { name: "Katherine Johnson" }]),
};

describe("PODCAST_PLATFORMS / getPodcastPlatform", () => {
  test("every platform is Tier B and has consent text + a submit URL — none of these have a bulk-publish API", () => {
    expect(PODCAST_PLATFORMS.length).toBe(4);
    for (const p of PODCAST_PLATFORMS) {
      expect(p.tier).toBe("B");
      expect(p.consentText).toBeTruthy();
      expect(p.submitUrl).toBeTruthy();
    }
  });

  test("getPodcastPlatform resolves a known id and returns undefined for an unknown one", () => {
    expect(getPodcastPlatform("SPOTIFY")?.label).toBe("Spotify");
    expect(getPodcastPlatform("NOT_A_PLATFORM")).toBeUndefined();
  });
});

describe("buildPodcastPackage", () => {
  test("includes title, joined host names, description, and category", () => {
    const pkg = buildPodcastPackage(PODCAST);
    expect(pkg.title).toBe(PODCAST.title);
    expect(pkg.hosts).toBe("Grace Hopper; Katherine Johnson");
    expect(pkg.description).toBe(PODCAST.description);
    expect(pkg.category).toBe(PODCAST.category);
  });

  test("derives a feed URL and a canonical URL from the podcast id", () => {
    const pkg = buildPodcastPackage(PODCAST);
    expect(pkg.feedUrl.endsWith(`/api/podcasts/${PODCAST.id}/rss.xml`)).toBe(true);
    expect(pkg.canonicalUrl.endsWith(`/podcast/${PODCAST.id}`)).toBe(true);
  });

  test("falls back to 'the hosts' when the hosts JSON has no usable names", () => {
    expect(buildPodcastPackage({ ...PODCAST, hosts: "[]" }).hosts).toBe("the hosts");
  });

  test("falls back to 'the hosts' when the hosts JSON is malformed", () => {
    expect(buildPodcastPackage({ ...PODCAST, hosts: "not json" }).hosts).toBe("the hosts");
  });
});
