"use client";

import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";
import { AUTHOR_FEES, READER_PLANS, usd } from "@/lib/plans";

const FAQ = [
  {
    q: "Is reading free?",
    a: "Yes. Every published article is open access under CC BY 4.0 — reading and downloading PDFs never needs a subscription. Reader plans add convenience features on top.",
  },
  {
    q: "When do authors pay?",
    a: "Only after acceptance. There's no submission fee and nothing to pay if a manuscript is declined. The Article Processing Charge invoice appears in your dashboard when your article is accepted.",
  },
  {
    q: "Can the publication charge be waived?",
    a: "Yes. Request a waiver when you submit — authors from lower-income economies and early-career researchers without funding are considered. The editor decides before any invoice is issued.",
  },
  {
    q: "Which payment methods are accepted?",
    a: "Cards and local methods through our payment partners (including Stripe, PayPal, PayMongo and Xendit, depending on your region). Institutions can also pay by purchase order.",
  },
  {
    q: "Can I cancel a reader plan?",
    a: "Any time. Your plan stays active until the end of the period you've paid for, and you won't be charged again.",
  },
];

/** /pricing — reader plans, author fees and billing FAQs. */
export function PricingView() {
  const user = useApp((s) => s.user);

  const choose = (plan: string) => {
    useApp.setState({ pendingPlan: plan });
    if (user) useApp.getState().openDashboard("reader");
    else {
      useApp.setState({ returnTab: "reader" });
      useApp.getState().setView("register");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <header className="mx-auto max-w-2xl text-center">
        <p className="eyebrow">Pricing</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Open to read. Fair to publish.</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Every article is free to read. Reader plans add convenience; authors pay only when their work is accepted.
        </p>
      </header>

      <section aria-labelledby="reader-plans" className="mt-14">
        <h2 id="reader-plans" className="sr-only">Reader plans</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {READER_PLANS.map((p) => (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-2xl border bg-card p-7 ${p.popular ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary" : "border-border"}`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-primary-foreground">
                  Best value
                </span>
              )}
              <h3 className="font-display text-xl font-semibold">{p.name}</h3>
              <p className="mt-1 min-h-[3rem] text-sm text-muted-foreground">{p.description}</p>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="font-display text-4xl font-semibold tabular-nums">{usd(p.price)}</span>
                <span className="text-sm text-muted-foreground">/ {p.period}</span>
              </p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" /> {f}
                  </li>
                ))}
              </ul>
              <Button className="mt-7 w-full" variant={p.popular ? "default" : "outline"} onClick={() => choose(p.id)}>
                {p.id === "INSTITUTIONAL" ? "Get institutional access" : `Choose ${p.name}`} <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="author-fees" className="mt-20">
        <div className="max-w-2xl">
          <p className="eyebrow">For authors</p>
          <h2 id="author-fees" className="mt-2 font-display text-3xl font-semibold">Publishing costs, in full</h2>
          <p className="mt-2 text-muted-foreground">No submission fee, no page charges, no colour charges.</p>
        </div>
        <div className="mt-8 divide-y divide-border rounded-2xl border border-border bg-card">
          {AUTHOR_FEES.map((f) => (
            <div key={f.name} className="grid gap-2 p-6 sm:grid-cols-[1fr_auto] sm:items-start">
              <div>
                <h3 className="font-display text-lg font-semibold">{f.name}</h3>
                <p className="text-xs font-medium uppercase tracking-wide text-primary">{f.when}</p>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{f.detail}</p>
              </div>
              <p className="font-display text-3xl font-semibold tabular-nums sm:text-right">{usd(f.price)}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => (user ? useApp.getState().openDashboard("submit") : useApp.getState().setView("register"))}>
            Submit a manuscript <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => useApp.getState().setView("policies")}>Read our policies</Button>
        </div>
      </section>

      <section aria-labelledby="pricing-faq" className="mt-20 max-w-3xl">
        <h2 id="pricing-faq" className="font-display text-3xl font-semibold">Questions</h2>
        <dl className="mt-6 divide-y divide-border border-y border-border">
          {FAQ.map((f) => (
            <div key={f.q} className="py-5">
              <dt className="font-medium">{f.q}</dt>
              <dd className="mt-1.5 text-sm text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
