import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BookOpen,
  Clock,
  FileDown,
  FileText,
  ListOrdered,
} from "lucide-react";
import { APP_BASE_URL, ARTICLE_LANGUAGE, JOURNAL_IDENTITY } from "@/lib/site";
import { BLOGS } from "@/lib/resources-content";
import { blogPath, blogPlainText, fmtLongDate, getBlogPost, guideById, guidePath, guidePdfPath, wordCount } from "@/lib/resources";
import { ResourcePageShell, BackToResources } from "@/components/resources/resource-page-shell";
import { FaqBlock, NumberedList, OnThisPage, ReferenceList, SectionBlock, slugifyHeading } from "@/components/resources/content-blocks";

/**
 * GET /resources/blog/[slug] — a crawlable, directly linkable Resources blog
 * post. Everything is rendered on the server:
 *
 * - the answer-first lede;
 * - the top-10 key takeaways;
 * - the question-led sections, FAQs and references;
 * - BlogPosting, FAQPage and BreadcrumbList JSON-LD.
 *
 * Search engines and answer engines therefore see the full text without
 * running JavaScript.
 */

export function generateStaticParams() {
  return BLOGS.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return { title: "Post not found" };
  const url = `${APP_BASE_URL}${blogPath(post)}`;
  return {
    title: `${post.title} | ${JOURNAL_IDENTITY.name}`,
    description: post.metaDescription,
    keywords: post.keywords,
    authors: [{ name: `Editorial Office, ${JOURNAL_IDENTITY.name}` }],
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.metaDescription,
      url,
      type: "article",
      siteName: JOURNAL_IDENTITY.name,
      publishedTime: post.datePublished,
      modifiedTime: post.dateModified,
      section: post.category,
      tags: post.keywords,
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.metaDescription },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const url = `${APP_BASE_URL}${blogPath(post)}`;
  const publisher = {
    "@type": "Organization",
    name: JOURNAL_IDENTITY.name,
    url: APP_BASE_URL,
    logo: { "@type": "ImageObject", url: `${APP_BASE_URL}/logo.svg` },
    email: JOURNAL_IDENTITY.editorialEmail,
  };
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.metaDescription,
      abstract: post.lede,
      url,
      mainEntityOfPage: url,
      datePublished: post.datePublished,
      dateModified: post.dateModified,
      inLanguage: ARTICLE_LANGUAGE,
      articleSection: post.category,
      keywords: post.keywords.join(", "),
      wordCount: wordCount(blogPlainText(post)),
      timeRequired: `PT${post.readMinutes}M`,
      isAccessibleForFree: true,
      license: JOURNAL_IDENTITY.licenseUrl,
      author: { "@type": "Organization", name: `Editorial Office, ${JOURNAL_IDENTITY.name}`, url: APP_BASE_URL },
      publisher,
      isPartOf: { "@type": "Blog", name: `${JOURNAL_IDENTITY.shortName} Resources Blog`, url: `${APP_BASE_URL}/` },
      citation: post.references.map((r) => ({ "@type": "CreativeWork", name: r.text, ...(r.url ? { url: r.url } : {}) })),
      // The ten takeaways and the lede are the passages most worth quoting.
      speakable: { "@type": "SpeakableSpecification", cssSelector: ["#lede", "#key-takeaways"] },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: post.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: JOURNAL_IDENTITY.shortName, item: APP_BASE_URL },
        { "@type": "ListItem", position: 2, name: "Resources", item: `${APP_BASE_URL}/` },
        { "@type": "ListItem", position: 3, name: post.title, item: url },
      ],
    },
  ];

  const toc = [
    { id: "key-takeaways", label: "Top 10 key takeaways" },
    ...post.sections.map((s) => ({ id: slugifyHeading(s.heading), label: s.heading })),
    { id: "faq", label: "Frequently asked questions" },
    { id: "references", label: "References" },
  ];
  const related = post.relatedGuides.map(guideById).filter((g): g is NonNullable<typeof g> => !!g);
  const more = BLOGS.filter((b) => b.id !== post.id).slice(0, 3);

  return (
    <ResourcePageShell tab="blogs">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <BackToResources tab="blogs" label="Resources · Blog" />

        <header className="mt-6 max-w-3xl border-b border-border pb-8">
          <p className="eyebrow">{post.category}</p>
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight sm:text-[2.6rem]">{post.title}</h1>
          <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>Editorial Office, {JOURNAL_IDENTITY.name}</span>
            <span aria-hidden>·</span>
            <time dateTime={post.dateModified}>Updated {fmtLongDate(post.dateModified)}</time>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {post.readMinutes} min read
            </span>
          </p>
        </header>

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="min-w-0 max-w-3xl space-y-12">
            <p
              id="lede"
              className="border-l-[3px] border-[var(--gold-500)] pl-5 font-display text-lg leading-relaxed text-foreground/90 sm:text-xl"
            >
              {post.lede}
            </p>

            <section id="key-takeaways" className="scroll-mt-24 rounded-xl border border-border bg-[var(--royal-50)]/60 p-5 dark:bg-white/[0.03] sm:p-6">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
                <ListOrdered className="h-5 w-5 text-primary" /> Top 10 key takeaways
              </h2>
              <div className="mt-4">
                <NumberedList items={post.keyTakeaways} label="Top 10 key takeaways" />
              </div>
            </section>

            {post.sections.map((s) => (
              <SectionBlock key={s.heading} section={s} />
            ))}

            <FaqBlock faqs={post.faqs} />
            <ReferenceList references={post.references} />

            {related.length > 0 && (
              <section aria-labelledby="related-guides">
                <h2 id="related-guides" className="font-display text-2xl font-semibold">Official guides on this topic</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {related.map((g) => (
                    <div key={g.id} className="paper-card rounded-lg border border-border p-4">
                      <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">{g.code} · Version {g.version}</p>
                      <Link href={guidePath(g)} className="mt-1 block font-display text-base font-semibold hover:text-primary">
                        {g.title}
                      </Link>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <Link href={guidePath(g)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                          <FileText className="h-3.5 w-3.5" /> Read online
                        </Link>
                        <a href={guidePdfPath(g)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                          <FileDown className="h-3.5 w-3.5" /> Download PDF
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section aria-labelledby="more-posts" className="border-t border-border pt-8">
              <h2 id="more-posts" className="font-display text-xl font-semibold">More from the blog</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                {more.map((b) => (
                  <li key={b.id}>
                    <Link href={blogPath(b)} className="paper-card block h-full rounded-lg border border-border p-4 hover:border-primary/40">
                      <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">{b.category}</p>
                      <p className="mt-1 font-display text-sm font-semibold leading-snug">{b.title}</p>
                      <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <BookOpen className="h-3 w-3" /> {b.readMinutes} min read
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <OnThisPage items={toc} />
            </div>
          </aside>
        </div>
      </article>
    </ResourcePageShell>
  );
}
