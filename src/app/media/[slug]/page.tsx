import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, ListChecks, ListOrdered } from "lucide-react";
import { APP_BASE_URL, ARTICLE_LANGUAGE, JOURNAL_IDENTITY } from "@/lib/site";
import {
  getMediaStory,
  MEDIA_STORIES,
  mediaCoverPath,
  mediaReadMinutes,
  mediaStoryPath,
  mediaWordCount,
  stripCitations,
} from "@/lib/media/stories";
import { stateForPath } from "@/lib/spa-routes";
import { getCurrentTenant } from "@/lib/tenant";
import { fmtLongDate } from "@/lib/resources";
import { slugifyHeading } from "@/components/resources/content-blocks";
import { CitedText } from "@/components/media/cited-text";
import { BackToMedia, MediaPageShell } from "@/components/media/media-page-shell";
import { SpaShell } from "@/components/spa-shell";

/**
 * GET /media/[slug] — a newsroom story or long-form blog post from
 * src/lib/media/stories.ts, rendered entirely on the server so search
 * engines and answer engines read the full text without JavaScript:
 *
 * - answer-first lede, key facts / top-10 takeaways, question-led sections;
 * - inline numbered citations linking to an APA reference list, each
 *   reference linking to its source;
 * - NewsArticle or BlogPosting, FAQPage and BreadcrumbList JSON-LD.
 *
 * Any other /media/<id> (a post written in the dashboard, stored as a
 * MediaPost row) falls through to the single-page app, as before.
 */

type Props = { params: Promise<{ slug: string }> };

/** Platform newsroom only: a whitelabel tenant's /media/<slug> is its own SPA route. */
async function storyFor(slug: string) {
  const story = getMediaStory(decodeURIComponent(slug));
  if (!story) return undefined;
  const tenant = await getCurrentTenant().catch(() => null);
  return tenant && !tenant.isPlatform ? undefined : story;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const story = await storyFor(slug);
  if (!story) {
    return { title: `Media — ${JOURNAL_IDENTITY.name}`, alternates: { canonical: `${APP_BASE_URL}/media/${encodeURIComponent(slug)}` } };
  }
  const url = `${APP_BASE_URL}${mediaStoryPath(story)}`;
  const image = { url: `${APP_BASE_URL}${mediaCoverPath(story)}`, width: 1200, height: 630, alt: story.cover.alt };
  const author = story.type === "NEWS" ? `Newsroom, ${JOURNAL_IDENTITY.name}` : `Editorial Office, ${JOURNAL_IDENTITY.name}`;
  return {
    title: `${story.title} | ${JOURNAL_IDENTITY.shortName}`,
    description: story.metaDescription,
    keywords: story.keywords,
    authors: [{ name: author }],
    alternates: { canonical: url },
    openGraph: {
      title: story.title,
      description: story.metaDescription,
      url,
      type: "article",
      siteName: JOURNAL_IDENTITY.name,
      publishedTime: story.datePublished,
      modifiedTime: story.dateModified,
      section: story.category,
      tags: story.keywords,
      images: [image],
    },
    twitter: { card: "summary_large_image", title: story.title, description: story.metaDescription, images: [image.url] },
    robots: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  };
}

export default async function MediaStoryPage({ params }: Props) {
  const { slug } = await params;
  const story = await storyFor(slug);
  if (!story) {
    const route = stateForPath(`/media/${encodeURIComponent(decodeURIComponent(slug))}`);
    if (!route) notFound();
    return <SpaShell initialRoute={route} />;
  }

  const url = `${APP_BASE_URL}${mediaStoryPath(story)}`;
  const cover = mediaCoverPath(story);
  const isNews = story.type === "NEWS";
  const authorName = isNews ? `Newsroom, ${JOURNAL_IDENTITY.name}` : `Editorial Office, ${JOURNAL_IDENTITY.name}`;
  const readMinutes = mediaReadMinutes(story);
  const publisher = {
    "@type": "Organization",
    name: JOURNAL_IDENTITY.name,
    url: APP_BASE_URL,
    logo: { "@type": "ImageObject", url: `${APP_BASE_URL}/logo.svg` },
  };
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": isNews ? "NewsArticle" : "BlogPosting",
      headline: story.title,
      alternativeHeadline: story.dek,
      description: story.metaDescription,
      abstract: stripCitations(story.lede),
      image: [`${APP_BASE_URL}${cover}`],
      url,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      datePublished: story.datePublished,
      dateModified: story.dateModified,
      inLanguage: ARTICLE_LANGUAGE,
      articleSection: story.category,
      keywords: story.keywords.join(", "),
      wordCount: mediaWordCount(story),
      timeRequired: `PT${readMinutes}M`,
      isAccessibleForFree: true,
      author: { "@type": "Organization", name: authorName, url: APP_BASE_URL },
      publisher,
      citation: story.references.map((r) => ({ "@type": "CreativeWork", name: r.text, ...(r.url ? { url: r.url } : {}) })),
      speakable: { "@type": "SpeakableSpecification", cssSelector: ["#lede", "#key-points"] },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: story.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: stripCitations(f.a) } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: JOURNAL_IDENTITY.shortName, item: APP_BASE_URL },
        { "@type": "ListItem", position: 2, name: "Media", item: `${APP_BASE_URL}/media` },
        { "@type": "ListItem", position: 3, name: story.title, item: url },
      ],
    },
  ];

  const keyLabel = isNews ? "Key facts" : "Top 10 key takeaways";
  const toc = [
    { id: "key-points", label: keyLabel },
    ...story.sections.map((s) => ({ id: slugifyHeading(s.heading), label: s.heading })),
    { id: "faq", label: "Frequently asked questions" },
    { id: "references", label: "Sources & references" },
  ];
  const more = MEDIA_STORIES.filter((s) => s.slug !== story.slug)
    .sort((a, b) => Number(b.type === story.type) - Number(a.type === story.type))
    .slice(0, 3);

  return (
    <MediaPageShell slug={story.slug}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <BackToMedia label="Media" />
          <span aria-hidden className="text-muted-foreground">/</span>
          <span className="text-muted-foreground">{isNews ? "News" : "Blog"}</span>
        </nav>

        <header className="mt-6 max-w-3xl">
          <p className="eyebrow">
            {isNews ? "News" : "Blog"} · {story.category}
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold leading-[1.08] tracking-tight sm:text-[2.75rem]">{story.title}</h1>
          <p className="mt-4 font-serif text-lg italic leading-relaxed text-muted-foreground sm:text-xl">{story.dek}</p>
          <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">By the {isNews ? "Newsroom" : "Editorial Office"}</span>
            <span aria-hidden>·</span>
            <time dateTime={story.datePublished}>{fmtLongDate(story.datePublished)}</time>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {readMinutes} min read
            </span>
            <span aria-hidden>·</span>
            <span>{story.references.length} sources</span>
          </p>
        </header>

        <figure className="mt-8 max-w-4xl">
          <img
            src={cover}
            alt={story.cover.alt}
            width={1200}
            height={630}
            fetchPriority="high"
            className="w-full rounded-xl border border-border object-cover shadow-[0_24px_64px_oklch(0.38_0.18_295/0.14)]"
          />
          <figcaption className="mt-2 text-xs text-muted-foreground">
            Graphic: {JOURNAL_IDENTITY.name} editorial studio. Data: {story.cover.source}.
          </figcaption>
        </figure>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="min-w-0 max-w-3xl space-y-12">
            <p id="lede" className="border-l-[3px] border-[var(--gold-500)] pl-5 font-display text-lg leading-relaxed text-foreground/90 sm:text-xl">
              <CitedText text={story.lede} />
            </p>

            <section id="key-points" className="scroll-mt-24 rounded-xl border border-border bg-[var(--royal-50)]/60 p-5 dark:bg-white/[0.03] sm:p-6">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
                {isNews ? <ListChecks className="h-5 w-5 text-primary" /> : <ListOrdered className="h-5 w-5 text-primary" />} {keyLabel}
              </h2>
              <ol className="mt-4 space-y-3">
                {story.keyPoints.map((k, i) => (
                  <li key={i} className="flex gap-3 text-[0.98rem] leading-relaxed text-foreground/85">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                    <span className="min-w-0">
                      <CitedText text={k} />
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            {story.sections.map((s) => (
              <section key={s.heading} id={slugifyHeading(s.heading)} className="scroll-mt-24">
                <h2 className="font-display text-2xl font-semibold leading-snug">{s.heading}</h2>
                <div className="mt-4 space-y-4 text-[1.02rem] leading-[1.8] text-foreground/85">
                  {s.paragraphs.map((p, i) => (
                    <p key={i}>
                      <CitedText text={p} />
                    </p>
                  ))}
                  {s.bullets && (
                    <ul className="space-y-2.5 pl-1">
                      {s.bullets.map((b, i) => (
                        <li key={i} className="flex gap-3">
                          <span aria-hidden className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rotate-45 bg-primary" />
                          <span className="min-w-0">
                            <CitedText text={b} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {s.after && (
                    <p>
                      <CitedText text={s.after} />
                    </p>
                  )}
                </div>
              </section>
            ))}

            <section id="faq" className="scroll-mt-24">
              <h2 className="font-display text-2xl font-semibold">Frequently asked questions</h2>
              <div className="mt-4 divide-y divide-border rounded-xl border border-border">
                {story.faqs.map((f) => (
                  <details key={f.q} className="group p-4 sm:p-5" open>
                    <summary className="cursor-pointer list-none font-display text-lg font-semibold marker:hidden">
                      <h3 className="inline">{f.q}</h3>
                    </summary>
                    <p className="mt-2 leading-relaxed text-foreground/85">
                      <CitedText text={f.a} />
                    </p>
                  </details>
                ))}
              </div>
            </section>

            <section id="references" className="scroll-mt-24">
              <h2 className="font-display text-2xl font-semibold">Sources &amp; references</h2>
              <ol className="mt-4 space-y-3 text-sm leading-relaxed text-foreground/80">
                {story.references.map((r, i) => (
                  <li key={i} id={`ref-${i + 1}`} className="scroll-mt-24 flex gap-3 break-words target:rounded-md target:bg-primary/5">
                    <span className="w-6 shrink-0 text-right font-semibold text-primary">{i + 1}.</span>
                    <span className="min-w-0">
                      <cite className="not-italic">{r.text}</cite>
                      {r.url && (
                        <>
                          {" "}
                          <a href={r.url} target="_blank" rel="noopener" className="break-all text-primary hover:underline">
                            {r.url.replace(/^https?:\/\//, "")}
                          </a>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-6 rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
                Editorial standards: every figure in this {isNews ? "story" : "post"} is taken from the source cited beside it, primary sources first.
                Spotted an error? Write to{" "}
                <a href={`mailto:${JOURNAL_IDENTITY.editorialEmail}`} className="text-primary hover:underline">
                  {JOURNAL_IDENTITY.editorialEmail}
                </a>{" "}
                and we will correct it.
              </p>
            </section>

            <section aria-labelledby="more-stories" className="border-t border-border pt-8">
              <h2 id="more-stories" className="font-display text-xl font-semibold">More from Media</h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-3">
                {more.map((s) => (
                  <li key={s.slug}>
                    <Link href={mediaStoryPath(s)} className="group block h-full overflow-hidden rounded-lg border border-border hover:border-primary/40">
                      <img src={mediaCoverPath(s)} alt={s.cover.alt} width={1200} height={630} loading="lazy" className="aspect-[1200/630] w-full object-cover" />
                      <div className="p-3">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
                          {s.type === "NEWS" ? "News" : "Blog"} · {s.category}
                        </p>
                        <p className="mt-1 font-display text-sm font-semibold leading-snug group-hover:text-primary">{s.title}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="hidden lg:block">
            <nav aria-label="On this page" className="sticky top-24">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">On this page</p>
              <ul className="mt-3 space-y-2 border-l border-border text-sm">
                {toc.map((t) => (
                  <li key={t.id}>
                    <a href={`#${t.id}`} className="-ml-px block border-l border-transparent pl-3 text-muted-foreground hover:border-primary hover:text-foreground">
                      {t.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        </div>
      </article>
    </MediaPageShell>
  );
}
