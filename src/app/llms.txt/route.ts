import { APP_BASE_URL, JOURNAL_IDENTITY, issnLabel } from "@/lib/site";
import { MEDIA_STORIES, stripCitations } from "@/lib/media/stories";
import { BLOGS, GUIDES } from "@/lib/resources-content";
import { OFFICIAL_FORMS } from "@/lib/forms";
import { getCurrentTenant } from "@/lib/tenant";
import { brandCode, brandContactLine, brandText } from "@/lib/resources/tenant-brand";
import { resourceBrandFor } from "@/lib/resources/tenant-brand-server";

/**
 * GET /llms.txt — a plain-Markdown map of the site's citable reference
 * content for AI assistants and answer engines (the llms.txt convention).
 * Lists the official guides (with their PDF editions) and the Resources
 * blog, all of which are server-rendered pages.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const tenant = await getCurrentTenant().catch(() => null);
  const brand = await resourceBrandFor(tenant);
  // The CDN keys on host + URL: a portal visitor or signed-in tenant member
  // on the official host must never get a publicly cached copy.
  const cacheControl =
    tenant && (tenant.source === "session" || tenant.source === "portal") ? "private, no-store" : "public, max-age=3600, s-maxage=86400";
  // A tenant's site: its own name, its guides and nothing of Eleventh
  // Press's own (blog, newsroom).
  if (brand.whitelabel) {
    const base = brand.baseUrl;
    const tenantLines = [
      `# ${brand.publisher}`,
      "",
      `> ${[brand.journalName !== brand.publisher ? brand.journalName : null, brandContactLine(brand)].filter(Boolean).join(". ")}`,
      "",
      "## Official guides",
      "",
      ...GUIDES.map(
        (g) =>
          `- [${g.title} (${brandCode(g.code, brand)}, v${g.version})](${base}/resources/guides/${g.slug}): ${brandText(g.summary, brand)} Benchmarked against: ${g.benchmarks.join("; ")}. PDF: ${base}/resources/guides/${g.slug}/pdf`
      ),
      "",
      "## Official forms",
      "",
      ...OFFICIAL_FORMS.map(
        (f) =>
          `- [${f.title} (${brandCode(f.code, brand)}, v${f.version})](${base}/resources/forms/${f.slug}): ${brandText(f.summary, brand)} Fillable PDF: ${base}/resources/forms/${f.slug}/pdf`
      ),
      "",
      "## Other",
      "",
      `- [Sitemap](${base}/sitemap.xml)`,
      `- [Article feed (RSS)](${base}/api/feed/articles.xml)`,
      "",
    ];
    return new Response(tenantLines.join("\n"), {
      headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": cacheControl },
    });
  }

  const J = JOURNAL_IDENTITY;
  const lines = [
    `# ${J.name}`,
    "",
    `> ${J.tagline}. Peer-reviewed, open-access (${J.license}) journal across twelve disciplines. ${issnLabel(J.issn)}. ${J.location}. Contact: ${J.editorialEmail}.`,
    "",
    "## Official guides",
    "",
    ...GUIDES.map(
      (g) =>
        `- [${g.title} (${g.code}, v${g.version})](${APP_BASE_URL}/resources/guides/${g.slug}): ${g.summary} Benchmarked against: ${g.benchmarks.join("; ")}. PDF: ${APP_BASE_URL}/resources/guides/${g.slug}/pdf`
    ),
    "",
    "## Official forms",
    "",
    ...OFFICIAL_FORMS.map(
      (f) =>
        `- [${f.title} (${f.code}, v${f.version})](${APP_BASE_URL}/resources/forms/${f.slug}): ${f.summary} Benchmarked against: ${f.benchmarks.join("; ")}. Fillable PDF: ${APP_BASE_URL}/resources/forms/${f.slug}/pdf`
    ),
    "",
    "## Resources blog",
    "",
    ...BLOGS.map((b) => `- [${b.title}](${APP_BASE_URL}/resources/blog/${b.slug}): ${b.excerpt}`),
    "",
    "## Newsroom",
    "",
    ...MEDIA_STORIES.filter((m) => m.type === "NEWS").map((m) => `- [${m.title}](${APP_BASE_URL}/media/${m.slug}): ${stripCitations(m.lede)}`),
    "",
    "## Media blog (long-form evidence reviews)",
    "",
    ...MEDIA_STORIES.filter((m) => m.type === "BLOG").map((m) => `- [${m.title}](${APP_BASE_URL}/media/${m.slug}): ${stripCitations(m.lede)}`),
    "",
    "## Other",
    "",
    `- [Sitemap](${APP_BASE_URL}/sitemap.xml)`,
    `- [Article feed (RSS)](${APP_BASE_URL}/api/feed/articles.xml)`,
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": cacheControl },
  });
}
