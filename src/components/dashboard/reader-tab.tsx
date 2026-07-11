"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { PaymentProviderPicker } from "@/components/billing/payment-provider-picker";
import {
  Library,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  Star,
  Download,
  Search,
} from "lucide-react";

interface Props {
  subscription: any;
  onRefresh: () => void;
}

const PLANS = [
  {
    id: "READER_MONTHLY",
    name: "Monthly Reader",
    price: 10,
    period: "month",
    description: "Full PDF access for casual readers and visiting researchers.",
    features: [
      "Unlimited PDF downloads",
      "Full-text search across all articles",
      "Email alerts for new issues",
      "Cancel anytime",
    ],
    popular: false,
  },
  {
    id: "READER_YEARLY",
    name: "Annual Reader",
    price: 97,
    period: "year",
    description: "Best value for active scholars and doctoral candidates.",
    features: [
      "Everything in Monthly",
      "Save ~19% vs. monthly billing",
      "Early access to forthcoming articles",
      "Citation export in BibTeX / RIS / APA",
      "Priority support",
    ],
    popular: true,
  },
  {
    id: "INSTITUTIONAL",
    name: "Institutional",
    price: 997,
    period: "year",
    description: "Site-wide access for libraries, universities, and research institutes.",
    features: [
      "Everything in Annual",
      "IP-range or SSO authentication",
      "Unlimited concurrent users",
      "COUNTER 5 usage reports",
      "Dedicated account manager",
    ],
    popular: false,
  },
];

export function ReaderTab({ subscription, onRefresh }: Props) {
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [pickerPlan, setPickerPlan] = useState<string | null>(null);

  async function checkoutSubscription(providerId: string) {
    if (!pickerPlan) return;
    setSubscribing(pickerPlan);
    try {
      const { redirectUrl } = await apiFetch<{ redirectUrl: string }>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ kind: "SUBSCRIPTION", plan: pickerPlan, provider: providerId }),
      });
      window.location.href = redirectUrl;
    } catch (e: any) {
      toast.error("Checkout failed", { description: e.message });
      setSubscribing(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Current subscription */}
      <Card className="paper-card">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Current subscription</p>
              {subscription ? (
                <>
                  <p className="mt-1 font-display text-xl font-semibold">
                    {subscription.plan.replace(/_/g, " ")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Status: <Badge variant="outline" className="ml-1 border-emerald-300 bg-emerald-50 text-emerald-700">{subscription.status}</Badge>
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Renews on {new Date(subscription.currentPeriodEnd).toLocaleDateString()} ·
                    Stripe ID <code className="font-mono text-[0.65rem]">{subscription.stripeSubId}</code>
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 font-display text-xl font-semibold">No active subscription</p>
                  <p className="text-sm text-muted-foreground">
                    Choose a plan below to access full PDF galleys of every published article.
                  </p>
                </>
              )}
            </div>
            {subscription && (
              <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                PDF access enabled
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plans */}
      <div>
        <p className="eyebrow mb-3">Subscription plans</p>
        <div className="grid gap-4 lg:grid-cols-3">
          {PLANS.map((p) => {
            const isCurrent = subscription?.plan === p.id && subscription?.status === "ACTIVE";
            return (
              <Card
                key={p.id}
                className={`paper-card relative ${p.popular ? "border-primary/40 shadow-md" : ""}`}
              >
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[0.65rem] font-medium text-primary-foreground">
                    Most popular
                  </div>
                )}
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="font-display text-lg font-semibold">{p.name}</p>
                    {p.popular && <Star className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="font-display text-3xl font-semibold">USD {p.price}</span>
                    <span className="text-xs text-muted-foreground">/ {p.period}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{p.description}</p>
                  <Separator className="my-3" />
                  <ul className="space-y-1.5 text-xs">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-1.5">
                        <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-emerald-600" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-4 w-full"
                    variant={p.popular ? "default" : "outline"}
                    disabled={isCurrent || subscribing !== null}
                    onClick={() => setPickerPlan(p.id)}
                  >
                    {subscribing === p.id && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    {isCurrent ? "Current plan" : <CreditCard className="mr-1.5 h-3.5 w-3.5" />}
                    {isCurrent ? "Active" : "Subscribe"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* How reader access works */}
      <Card className="paper-card bg-muted/30">
        <CardContent className="p-5 text-xs text-muted-foreground">
          <p className="font-display text-sm font-semibold text-foreground">
            How reader access works
          </p>
          <p className="mt-1">
            The API Gateway intercepts every request to a full PDF galley. It verifies the
            user’s JWT, queries the Billing Service to confirm an active subscription, and
            either serves a short-lived S3 pre-signed URL or returns
            <code className="mx-1 font-mono">402 Payment Required</code>. The gateway caches
            subscription status in Redis for 60 seconds to amortise the billing lookup.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <AccessFlow icon={Search} label="Browse" desc="Reader searches and opens article pages — always free." />
            <AccessFlow icon={Library} label="Abstract" desc="Abstracts, keywords, and metadata are always open-access." />
            <AccessFlow icon={Download} label="PDF galley" desc="PDF download gated by subscription check." />
          </div>
        </CardContent>
      </Card>

      <PaymentProviderPicker
        open={pickerPlan !== null}
        onOpenChange={(open) => !open && setPickerPlan(null)}
        onSelect={checkoutSubscription}
        busy={subscribing !== null}
      />
    </div>
  );
}

function AccessFlow({ icon: Icon, label, desc }: { icon: any; label: string; desc: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <p className="mt-1 font-sans text-xs font-semibold">{label}</p>
      <p className="mt-0.5 text-[0.7rem]">{desc}</p>
    </div>
  );
}
