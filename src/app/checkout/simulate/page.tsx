"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2, ShieldAlert, CheckCircle2 } from "lucide-react";

const PROVIDER_LABELS: Record<string, string> = {
  stripe: "Stripe",
  paypal: "PayPal",
  paymongo: "PayMongo",
  xendit: "Xendit",
  lemonsqueezy: "Lemon Squeezy",
};

function SimulateCheckoutInner() {
  const params = useSearchParams();
  const provider = params.get("provider") || "";
  const referenceId = params.get("ref") || "";
  const providerRef = params.get("providerRef") || "";
  const amount = params.get("amount") || "0.00";
  const description = params.get("desc") || "Payment";

  const [state, setState] = useState<"idle" | "paying" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function pay() {
    setState("paying");
    try {
      await apiFetch("/api/billing/simulate-confirm", {
        method: "POST",
        body: JSON.stringify({ referenceId, provider, providerRef }),
      });
      setState("done");
    } catch (e: any) {
      setError(e.message);
      setState("error");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          Simulation mode — {PROVIDER_LABELS[provider] || provider} has no live API keys configured, so
          this page stands in for its hosted checkout. No real charge occurs.
        </div>

        <div className="mt-6">
          <p className="eyebrow">{PROVIDER_LABELS[provider] || provider} checkout</p>
          <p className="mt-1 font-display text-xl font-semibold">{description}</p>
          <p className="mt-2 font-mono text-3xl font-semibold text-primary">USD {amount}</p>
        </div>

        {state === "done" ? (
          <div className="mt-6 flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            Payment confirmed. You can close this tab and return to your dashboard.
          </div>
        ) : (
          <>
            <Button
              size="lg"
              className="mt-6 w-full"
              onClick={pay}
              disabled={state === "paying"}
            >
              {state === "paying" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Simulate payment
            </Button>
            {state === "error" && (
              <p className="mt-3 text-sm text-destructive">{error}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SimulateCheckoutPage() {
  return (
    <Suspense fallback={null}>
      <SimulateCheckoutInner />
    </Suspense>
  );
}
