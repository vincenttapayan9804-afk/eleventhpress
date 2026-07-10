"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Receipt,
  CreditCard,
  CheckCircle2,
  Clock,
  Loader2,
  Download,
  FileText,
  Library,
  Calendar,
} from "lucide-react";

interface Props {
  invoices: any[];
  subscription: any;
  onRefresh: () => void;
}

export function InvoicesTab({ invoices, subscription, onRefresh }: Props) {
  const [paying, setPaying] = useState<string | null>(null);

  async function payInvoice(id: string) {
    setPaying(id);
    try {
      await apiFetch("/api/billing/apc", {
        method: "POST",
        body: JSON.stringify({ invoiceId: id }),
      });
      toast.success("Payment received", {
        description: "Stripe webhook confirmed. Article moved to production.",
      });
      onRefresh();
    } catch (e: any) {
      toast.error("Payment failed", { description: e.message });
    } finally {
      setPaying(null);
    }
  }

  const totalPaid = invoices
    .filter((i) => i.status === "PAID")
    .reduce((s, i) => s + i.amount, 0);
  const totalOpen = invoices
    .filter((i) => i.status === "OPEN")
    .reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="paper-card">
          <CardContent className="p-5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <p className="mt-2 font-display text-2xl font-semibold">
              USD {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground">Total paid</p>
          </CardContent>
        </Card>
        <Card className="paper-card">
          <CardContent className="p-5">
            <Clock className="h-5 w-5 text-amber-600" />
            <p className="mt-2 font-display text-2xl font-semibold">
              USD {totalOpen.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground">Open balance</p>
          </CardContent>
        </Card>
        <Card className="paper-card">
          <CardContent className="p-5">
            <Library className="h-5 w-5 text-primary" />
            <p className="mt-2 font-display text-sm font-semibold">
              {subscription ? subscription.plan.replace(/_/g, " ") : "No subscription"}
            </p>
            <p className="text-xs text-muted-foreground">
              {subscription
                ? `Renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                : "Subscribe to access full PDFs"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Subscription panel */}
      <Card className="paper-card">
        <CardHeader>
          <p className="eyebrow">Active subscription</p>
        </CardHeader>
        <CardContent>
          {subscription ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="font-display text-lg font-semibold">{subscription.plan.replace(/_/g, " ")}</p>
                <p className="text-sm text-muted-foreground">Status: {subscription.status}</p>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <p className="flex items-center justify-between">
                    <span><Calendar className="mr-1.5 inline h-3 w-3" />Renewal date</span>
                    <span className="font-medium text-foreground">
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                    </span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span>Stripe ID</span>
                    <code className="font-mono text-[0.65rem]">{subscription.stripeSubId}</code>
                  </p>
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">How reader access works</p>
                <p className="mt-1">
                  The API Gateway intercepts every request to a full PDF. It verifies your JWT,
                  queries this subscription record, and either issues a short-lived S3 pre-signed URL
                  or returns <code className="font-mono">402 Payment Required</code>.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-sm font-semibold">No active subscription</p>
                <p className="text-xs text-muted-foreground">
                  Subscribe to download full PDF galleys of every published article.
                </p>
              </div>
              <Button variant="outline" disabled>
                See plans
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoices table */}
      <Card className="paper-card">
        <CardHeader>
          <p className="eyebrow">Invoices</p>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <div className="space-y-2">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-md ${
                      inv.type === "APC" ? "bg-primary/10 text-primary" : "bg-emerald-100 text-emerald-700"
                    }`}>
                      {inv.type === "APC" ? <FileText className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {inv.type === "APC"
                          ? `APC · ${inv.article?.title?.slice(0, 60) || "Article"}${inv.article?.title?.length > 60 ? "…" : ""}`
                          : inv.type === "SUBSCRIPTION"
                          ? "Reader subscription"
                          : inv.type}
                      </p>
                      <p className="font-mono text-[0.65rem] text-muted-foreground">
                        {inv.id.slice(0, 12)} · {new Date(inv.createdAt).toLocaleDateString()} · {inv.stripeInvoiceId || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-display text-sm font-semibold">
                        {inv.currency} {inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                      <Badge
                        variant="outline"
                        className={`text-[0.6rem] ${
                          inv.status === "PAID" ? "border-emerald-300 bg-emerald-50 text-emerald-700" :
                          inv.status === "OPEN" ? "border-amber-300 bg-amber-50 text-amber-700" : ""
                        }`}
                      >
                        {inv.status}
                      </Badge>
                    </div>
                    {inv.status === "OPEN" && (
                      <Button
                        size="sm"
                        onClick={() => payInvoice(inv.id)}
                        disabled={paying === inv.id}
                      >
                        {paying === inv.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Pay now
                      </Button>
                    )}
                    {inv.status === "PAID" && (
                      <Button size="sm" variant="ghost" disabled>
                        <Download className="mr-1.5 h-3.5 w-3.5" /> Receipt
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


