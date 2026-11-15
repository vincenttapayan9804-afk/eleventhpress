import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpenText, MessageSquareText, ShieldCheck } from "lucide-react";
import { getCurrentTenant } from "@/lib/tenant";
import { loadSharedConversation } from "@/lib/research-share";
import { loadJournalInfo } from "@/lib/research-assistant";
import { withTrademark } from "@/lib/brand-mark";
import type { AnswerCitation, AnswerSource } from "@/lib/answer-integrity";
import { ContinueSharedButton, SharedConversationShell } from "@/components/research-assistant/shared-page-shell";

/**
 * GET /research/shared/[token] — a Research Assistant conversation a reader
 * chose to share: their questions and the assistant's cited answers with
 * the verified sources, read-only. Not indexed by search engines; works
 * only on the site of the institution it was held on; stops working as
 * soon as the reader revokes the link.
 */
type Props = { params: Promise<{ token: string }> };

export const dynamic = "force-dynamic";

async function load(token: string) {
  const tenant = await getCurrentTenant().catch(() => null);
  const shared = await loadSharedConversation(token, tenant);
  const journal = await loadJournalInfo(tenant && !tenant.isPlatform ? tenant.id : null);
  return { shared, journal };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const { shared, journal } = await load(token);
  return {
    title: shared ? `${shared.title} — shared research conversation | ${journal.name}` : `Shared conversation | ${journal.name}`,
    description: `A conversation with ${journal.name}'s AI Research Assistant, answered only from the journal's published articles, with citations.`,
    robots: { index: false, follow: false },
  };
}

interface StoredAnswer {
  grounded?: boolean;
  citations?: AnswerCitation[];
  sources?: AnswerSource[];
  coverage?: { citedArticles?: number; corpusArticles?: number | null; scope?: string | null };
}

function linkCitations(md: string, messageId: string): string {
  return md.replace(/\[(\d{1,3})\](?!\()/g, (_m, n: string) => `[${n}](#${messageId}-c${n})`);
}

function components(messageId: string, citations: AnswerCitation[]): Components {
  return {
    a: ({ href, children }) => {
      if (href?.startsWith(`#${messageId}-c`)) {
        const n = Number(href.slice(messageId.length + 3));
        const c = citations.find((x) => x.n === n);
        return (
          <a
            href={c ? `#${messageId}-s${c.sourceN}` : undefined}
            className="mx-0.5 inline-flex h-[1.3rem] min-w-[1.3rem] -translate-y-px items-center justify-center rounded-[5px] border border-[var(--royal-300)]/50 bg-[var(--royal-50)] px-1 align-middle text-xs font-semibold text-primary no-underline hover:bg-primary hover:text-primary-foreground"
            aria-label={`Citation ${n}`}
          >
            {children}
          </a>
        );
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-primary underline underline-offset-2">
          {children}
        </a>
      );
    },
    h1: ({ children }) => <h3 className="mb-2 mt-5 font-display text-lg font-semibold first:mt-0">{children}</h3>,
    h2: ({ children }) => <h3 className="mb-2 mt-5 font-display text-lg font-semibold first:mt-0">{children}</h3>,
    h3: ({ children }) => <h3 className="mb-2 mt-5 font-display text-base font-semibold first:mt-0">{children}</h3>,
    p: ({ children }) => <p className="my-2.5 leading-[1.75] first:mt-0 last:mb-0">{children}</p>,
    ul: ({ children }) => <ul className="my-2.5 list-disc space-y-1.5 pl-5">{children}</ul>,
    ol: ({ children }) => <ol className="my-2.5 list-decimal space-y-1.5 pl-5">{children}</ol>,
    table: ({ children }) => (
      <div className="my-3.5 overflow-x-auto rounded-lg border border-border/80">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-[var(--royal-50)] text-xs uppercase tracking-wide text-[var(--royal-800)]">{children}</thead>,
    th: ({ children }) => <th className="border-b border-border/80 px-3 py-2 font-semibold">{children}</th>,
    td: ({ children }) => <td className="border-b border-border/50 px-3 py-2 align-top">{children}</td>,
    blockquote: ({ children }) => <blockquote className="my-3 border-l-2 border-[var(--gold-400)] pl-3.5 text-muted-foreground">{children}</blockquote>,
  };
}

function urlTransform(url: string): string {
  return url.startsWith("#") ? url : defaultUrlTransform(url);
}

export default async function SharedConversationPage({ params }: Props) {
  const { token } = await params;
  const { shared, journal } = await load(token);
  if (!shared) notFound();
  const journalName = withTrademark(journal.name) ?? journal.name;
  const answered = shared.messages.filter((m) => m.role === "assistant").length;

  return (
    <SharedConversationShell>
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold-600)]">
          <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" /> Shared research conversation
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold leading-tight text-foreground sm:text-3xl">{shared.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {answered} answer{answered === 1 ? "" : "s"} from {journalName}&apos;s AI Research Assistant, drawn only from the journal&apos;s published articles
          and cited to the passages they come from. Shared by a reader; AI answers can contain errors, so check the cited sources.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <ContinueSharedButton token={token} />
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> Citations checked against the journal&apos;s records
          </span>
        </div>

        <div className="mt-8 space-y-6">
          {shared.messages.map((m) => {
            if (m.role === "user") {
              return (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[var(--royal-50)] px-4 py-2.5 text-[0.95rem] leading-relaxed text-foreground ring-1 ring-[var(--royal-200)]/60">
                    {m.content}
                  </p>
                </div>
              );
            }
            const data = (m.data ?? {}) as StoredAnswer;
            const citations = Array.isArray(data.citations) ? data.citations : [];
            const sources = Array.isArray(data.sources) ? data.sources : [];
            return (
              <article key={m.id} className="rounded-2xl border border-border/80 bg-card px-4 py-4 shadow-sm sm:px-5" aria-label="Research Assistant answer">
                {data.grounded === false && (
                  <p className="mb-3 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">The journal&apos;s published articles don&apos;t cover this question.</p>
                )}
                <div className="text-[0.95rem] text-foreground/90">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={urlTransform} components={components(m.id, citations)}>
                    {linkCitations(m.content, m.id)}
                  </ReactMarkdown>
                </div>
                {sources.length > 0 && (
                  <section className="mt-4 border-t border-border/60 pt-3" aria-label="Sources">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      <BookOpenText className="h-3.5 w-3.5" aria-hidden="true" /> Sources
                    </p>
                    <ol className="space-y-2">
                      {sources.map((s) => (
                        <li key={s.id} id={`${m.id}-s${s.n}`} className="scroll-mt-24 text-sm leading-relaxed">
                          <span className="mr-1.5 font-semibold text-primary">[{s.n}]</span>
                          {s.reference || s.title}{" "}
                          <a href={s.url} className="font-medium text-primary underline underline-offset-2">
                            Read the article
                          </a>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </SharedConversationShell>
  );
}
