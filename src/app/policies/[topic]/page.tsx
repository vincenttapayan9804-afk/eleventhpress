import { WCAG_CLAIM } from "@/lib/wcag-claim";
import { CcLicenceBadge, OpenAccessIcon, WcagConformanceLogo } from "@/components/badges/open-badges";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { getCurrentTenant } from "@/lib/tenant";
import { searchDescription } from "@/lib/seo-text";
import { JOURNAL_IDENTITY } from "@/lib/site";
import { POLICY_PAGES_UPDATED, POLICY_SLUGS, isPolicySlug, policyPages, type PolicyBlock } from "@/lib/policy-pages";

/** The visiting site's name and editorial contact — a whitelabel tenant's own, never Eleventh Press's. */
async function siteIdentity(): Promise<{ name: string; email: string }> {
  const tenant = await getCurrentTenant().catch(() => null);
  if (tenant && !tenant.isPlatform) {
    return {
      name: tenant.siteName || tenant.name,
      email: tenant.officialEmail || tenant.supportEmail || "the editorial office",
    };
  }
  return { name: JOURNAL_IDENTITY.name, email: JOURNAL_IDENTITY.editorialEmail };
}

export function generateStaticParams() {
  return POLICY_SLUGS.map((topic) => ({ topic }));
}

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }): Promise<Metadata> {
  const { topic } = await params;
  if (!isPolicySlug(topic)) return {};
  const { name, email } = await siteIdentity();
  const page = policyPages(name, email)[topic];
  return {
    title: `${page.title} — ${name}`,
    description: searchDescription(page.summary),
    alternates: { canonical: `/policies/${topic}` },
  };
}

function Block({ block }: { block: PolicyBlock }) {
  if (block.kind === "p") return <p className="leading-relaxed text-foreground/85">{block.text}</p>;
  if (block.kind === "list") {
    return (
      <ul className="list-disc space-y-2 pl-5 leading-relaxed text-foreground/85 marker:text-primary">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  if (block.kind === "links") {
    return (
      <ul className="space-y-3" data-testid="policy-resource-links">
        {block.items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-2 hover:underline"
            >
              {item.label}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <p className="leading-relaxed text-foreground/85">{item.note}</p>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ol className="space-y-3">
      {block.items.map((step, i) => (
        <li key={step.title} className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {i + 1}
          </span>
          <div>
            <p className="font-semibold text-foreground">{step.title}</p>
            <p className="leading-relaxed text-foreground/85">{step.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** GET /policies/<topic> — the public pages behind the footer's policy links. */
export default async function PolicyTopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  if (!isPolicySlug(topic)) notFound();
  const { name, email } = await siteIdentity();
  const pages = policyPages(name, email);
  const page = pages[topic];
  const others = POLICY_SLUGS.filter((s) => s !== topic).map((s) => pages[s]);

  return (
    <main id="main-content" className="min-h-dvh">
      <div className="mx-auto max-w-4xl px-4 pt-6 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> {name}
        </Link>
      </div>

      <article data-testid={`policy-page-${topic}`} className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <header className="border-b border-[var(--royal-300)]/15 pb-8">
          <p className="eyebrow">{page.eyebrow}</p>
          <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{page.title}</h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">{page.summary}</p>
          {topic === "open-access" && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="policy-open-access-marks">
              <OpenAccessIcon className="h-8" title="Open Access symbol" />
              <CcLicenceBadge code={JOURNAL_IDENTITY.license} />
              <p className="text-xs text-muted-foreground">
                Open Access symbol designed by PLOS (<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="license noopener noreferrer" className="underline underline-offset-2">CC BY-SA 3.0</a>). Creative Commons licence buttons by Creative Commons.
              </p>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Last updated {page.updated ?? POLICY_PAGES_UPDATED}</p>
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {page.highlights.map((h) => (
              <div key={h.label} className="rounded-xl border border-primary/15 bg-primary/[0.04] p-3">
                <dt className="text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">{h.label}</dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">{h.value}</dd>
              </div>
            ))}
          </dl>
        </header>

        <div className="mt-10 space-y-10">
          {page.sections.map((section) => (
            <section key={section.heading} className="space-y-4">
              <h2 className="font-display text-xl font-semibold sm:text-2xl">{section.heading}</h2>
              {section.blocks.map((block, i) => (
                <Block key={i} block={block} />
              ))}
            </section>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-3 rounded-xl border border-border p-3 text-xs text-muted-foreground" data-testid="wcag-claim">
          <WcagConformanceLogo />
          <p className="max-w-xl">
            This page conforms to WCAG 2.2 Level AA, as evaluated by us on {WCAG_CLAIM.evaluatedOn}. This is our own claim, not a
            W3C certification, and it covers only the policy pages. <a href="/accessibility" className="text-primary underline underline-offset-2">Scope and details</a>.
          </p>
        </div>

        <aside className="mt-8 grid gap-6 border-t border-[var(--royal-300)]/15 pt-8 sm:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Further reading</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {page.related.map((r) => {
                const external = r.href.startsWith("http");
                return (
                  <li key={r.href}>
                    <a
                      href={r.href}
                      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
                      className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                    >
                      {r.label}
                      {external && <ArrowUpRight className="h-3.5 w-3.5" />}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Other policies</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {others.map((o) => (
                <li key={o.slug}>
                  <Link href={`/policies/${o.slug}`} className="text-primary underline-offset-2 hover:underline">
                    {o.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </article>
    </main>
  );
}
