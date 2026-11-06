import Link from "next/link";
import type { ContentSection, Faq, Reference } from "@/lib/resources/types";

/**
 * Server-rendered building blocks shared by the blog-post and guide pages.
 * Plain semantic HTML (h2, ol, details, cite), so the full text is in the
 * initial HTML for crawlers and answer engines and reads well without
 * JavaScript.
 */

export function slugifyHeading(h: string): string {
  return h
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export function SectionBlock({ section, number }: { section: ContentSection; number?: number }) {
  return (
    <section id={slugifyHeading(section.heading)} className="scroll-mt-24">
      <h2 className="flex items-baseline gap-3 font-display text-2xl font-semibold leading-snug text-foreground">
        {number !== undefined && (
          <span className="shrink-0 font-sans text-xs font-bold tracking-wider text-[var(--gold-600)]">
            {String(number).padStart(2, "0")}
          </span>
        )}
        <span className="min-w-0">{section.heading}</span>
      </h2>
      <div className="mt-4 space-y-4 text-[1.02rem] leading-[1.8] text-foreground/85">
        {section.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {section.bullets && (
          <ul className="space-y-2.5 pl-1">
            {section.bullets.map((b, i) => (
              <li key={i} className="flex gap-3">
                <span aria-hidden className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rotate-45 bg-primary" />
                <span className="min-w-0">{b}</span>
              </li>
            ))}
          </ul>
        )}
        {section.after && <p>{section.after}</p>}
      </div>
    </section>
  );
}

export function NumberedList({ items, label }: { items: string[]; label: string }) {
  return (
    <ol aria-label={label} className="grid gap-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 rounded-lg border border-border/70 bg-background/60 p-3.5">
          <span
            aria-hidden
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-sans text-xs font-bold text-primary-foreground"
          >
            {i + 1}
          </span>
          <span className="min-w-0 self-center text-[0.97rem] leading-relaxed text-foreground/90">{item}</span>
        </li>
      ))}
    </ol>
  );
}

export function FaqBlock({ faqs, title = "Frequently asked questions" }: { faqs: Faq[]; title?: string }) {
  return (
    <section id="faq" className="scroll-mt-24">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <div className="mt-4 divide-y divide-border rounded-lg border border-border">
        {faqs.map((f, i) => (
          <details key={i} className="group p-4 [&_summary::-webkit-details-marker]:hidden" open={i === 0}>
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-display text-base font-semibold">
              <span className="min-w-0">{f.q}</span>
              <span aria-hidden className="mt-0.5 shrink-0 text-primary transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2.5 text-[0.97rem] leading-relaxed text-foreground/80">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function ReferenceList({ references }: { references: Reference[] }) {
  return (
    <section id="references" className="scroll-mt-24">
      <h2 className="font-display text-2xl font-semibold">References</h2>
      <ol className="mt-4 space-y-3 text-sm leading-relaxed text-foreground/80">
        {references.map((r, i) => (
          <li key={i} className="pl-8 -indent-8 break-words">
            <cite className="not-italic">{r.text}</cite>
            {r.url && (
              <>
                {" "}
                <a href={r.url} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">
                  {r.url.replace(/^https?:\/\//, "")}
                </a>
              </>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function OnThisPage({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="eyebrow">On this page</p>
      <ol className="mt-3 space-y-2 border-l border-border">
        {items.map((it) => (
          <li key={it.id}>
            <Link href={`#${it.id}`} className="-ml-px block border-l border-transparent pl-3 leading-snug text-muted-foreground hover:border-primary hover:text-foreground">
              {it.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
