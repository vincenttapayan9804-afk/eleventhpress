/**
 * Podcast distribution — same shape and honesty pattern as
 * src/lib/book-distribution.ts. Unlike books, every major podcast
 * directory here is fed the exact same way: submit the show's RSS feed URL
 * (src/lib/podcast-rss.ts) through that platform's own onboarding form —
 * there's no bulk-publish API to integrate against, and no "manuscript" to
 * upload per-platform since the feed itself carries every episode. So
 * every platform is Tier B in the same sense book distribution uses that
 * tier: a real, prefilled package (the feed URL + show metadata), a human
 * finishes the actual submission on the platform's own site.
 */
import { APP_BASE_URL } from "@/lib/site";

export type PodcastDistributionTier = "B";

export interface PodcastDistributionPlatform {
  id: string;
  label: string;
  tier: PodcastDistributionTier;
  postingHint: string;
  consentText: string;
  submitUrl: string;
}

export const PODCAST_PLATFORMS: PodcastDistributionPlatform[] = [
  {
    id: "APPLE_PODCASTS",
    label: "Apple Podcasts",
    tier: "B",
    postingHint: "Continue to Apple Podcasts Connect, add a new show, then paste in the RSS feed URL below.",
    consentText: "I confirm I hold full distribution rights to this show and am authorized to publish it on Apple Podcasts.",
    submitUrl: "https://podcastsconnect.apple.com/",
  },
  {
    id: "SPOTIFY",
    label: "Spotify",
    tier: "B",
    postingHint: "Continue to Spotify for Podcasters, add a new show by RSS feed, then paste in the feed URL below.",
    consentText: "I confirm I hold full distribution rights to this show and am authorized to publish it on Spotify.",
    submitUrl: "https://podcasters.spotify.com/",
  },
  {
    id: "AMAZON_MUSIC",
    label: "Amazon Music",
    tier: "B",
    postingHint: "Continue to Amazon Music for Podcasters, add a new show by RSS feed, then paste in the feed URL below.",
    consentText: "I confirm I hold full distribution rights to this show and am authorized to publish it on Amazon Music.",
    submitUrl: "https://podcasters.amazon.com/",
  },
  {
    id: "YOUTUBE_MUSIC",
    label: "YouTube Music",
    tier: "B",
    postingHint: "Continue to YouTube Studio's podcasts RSS feed import, then paste in the feed URL below.",
    consentText: "I confirm I hold full distribution rights to this show and am authorized to publish it on YouTube Music.",
    submitUrl: "https://podcasts.youtube.com/",
  },
];

export function getPodcastPlatform(id: string): PodcastDistributionPlatform | undefined {
  return PODCAST_PLATFORMS.find((p) => p.id === id);
}

interface PodcastForPackage {
  id: string;
  title: string;
  description: string;
  category: string;
  hosts: string; // JSON array of {name, bio?}
}

export interface PodcastDistributionPackage {
  title: string;
  hosts: string; // "Name; Name"
  description: string;
  category: string;
  feedUrl: string;
  canonicalUrl: string;
}

/** Builds the prefilled submission package — pure function, no DB/network access. */
export function buildPodcastPackage(podcast: PodcastForPackage): PodcastDistributionPackage {
  let hostNames = "the hosts";
  try {
    const parsed = JSON.parse(podcast.hosts) as { name?: string }[];
    const names = parsed.map((h) => h.name).filter(Boolean);
    if (names.length > 0) hostNames = names.join("; ");
  } catch {}

  return {
    title: podcast.title,
    hosts: hostNames,
    description: podcast.description.trim(),
    category: podcast.category,
    feedUrl: `${APP_BASE_URL}/api/podcasts/${podcast.id}/rss.xml`,
    canonicalUrl: `${APP_BASE_URL}/podcast/${podcast.id}`,
  };
}
