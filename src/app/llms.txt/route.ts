import { APP_BASE_URL, JOURNAL_IDENTITY } from "@/lib/site";
import { BLOGS, GUIDES } from "@/lib/resources-content";

/**
 * GET /llms.txt — a plain-Markdown map of the site's citable reference
 * content for AI assistants and answer engines (the llms.txt convention).
 * Lists the official guides (with their PDF editions) and the Resources
 * blog, all of which are server-rendered pages.
 */
export const dynamic = "force-static";

export function GET() {
  const J = JOURNAL_IDENTITY;
  const lines = [
    `# ${J.name}`,
    "",
    `> ${J.tagline}. Peer-reviewed, open-access (${J.license}) journal across twelve disciplines. ISSN ${J.issn}. ${J.location}. Contact: ${J.editorialEmail}.`,
    "",
    "## Official guides",
    "",
    ...GUIDES.map(
      (g) =>
        `- [${g.title} (${g.code}, v${g.version})](${APP_BASE_URL}/resources/guides/${g.slug}): ${g.summary} Benchmarked against: ${g.benchmarks.join("; ")}. PDF: ${APP_BASE_URL}/resources/guides/${g.slug}/pdf`
    ),
    "",
    "## Resources blog",
    "",
    ...BLOGS.map((b) => `- [${b.title}](${APP_BASE_URL}/resources/blog/${b.slug}): ${b.excerpt}`),
    "",
    "## Other",
    "",
    `- [Sitemap](${APP_BASE_URL}/sitemap.xml)`,
    `- [Article feed (RSS)](${APP_BASE_URL}/api/feed/articles.xml)`,
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
