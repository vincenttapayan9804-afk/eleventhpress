"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Building2,
  Globe2,
  Network,
  RefreshCw,
  Loader2,
  CheckCircle2,
  MapPin,
  Shield,
} from "lucide-react";

interface Institution {
  id: string;
  name: string;
  domain: string | null;
  country: string | null;
  ipRanges: string;
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  apcQuota: number;
  apcUsed: number;
  counterCustomerId: string | null;
  userCount: number;
  datasetCount: number;
}

export function InstitutionsTab() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [ipMatch, setIpMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [instRes, ipRes] = await Promise.all([
        apiFetch<{ institutions: Institution[] }>("/api/institutions/list").catch(() => ({ institutions: [] })),
        apiFetch<any>("/api/institutions/ip-check").catch(() => ({ matched: false })),
      ]);
      setInstitutions(instRes.institutions || []);
      setIpMatch(ipRes);
    } catch (e) {
      toast.error("Failed to load institutions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* IP check result */}
      <Card className="paper-card bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Network className="mt-1 h-5 w-5 flex-shrink-0 text-primary" />
              <div>
                <p className="font-display text-base font-semibold">Your IP authentication status</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  The API Gateway checks your IP address against all registered institutions.
                  If you're on a subscribing institution's network, you get automatic full-text
                  access without needing to log in.
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <code className="rounded bg-muted px-2 py-1 font-mono">{ipMatch?.ip || "unknown"}</code>
                  {ipMatch?.matched ? (
                    <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Matched: {ipMatch.institution.name}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                      No institutional match
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Institutions list */}
      <Card className="paper-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <p className="eyebrow">Registered institutions</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {institutions.length} institution{institutions.length === 1 ? "" : "s"} with active subscriptions.
            Transformative agreements include an APC quota for affiliated authors.
          </p>
        </CardHeader>
        <CardContent>
          {institutions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No institutions registered. Create one via the API.
            </p>
          ) : (
            <div className="space-y-3">
              {institutions.map((inst) => (
                <div key={inst.id} className="rounded-md border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-semibold">{inst.name}</h3>
                        <Badge variant="outline" className={`text-[0.6rem] ${
                          inst.plan === "TRANSFORMATIVE"
                            ? "border-primary/30 bg-primary/5 text-primary"
                            : "border-stone-300 bg-stone-100 text-stone-700"
                        }`}>
                          {inst.plan.replace(/_/g, " ")}
                        </Badge>
                        <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[0.6rem]">
                          {inst.status}
                        </Badge>
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                        {inst.domain && (
                          <p className="flex items-center gap-1">
                            <Globe2 className="h-3 w-3" /> {inst.domain}
                          </p>
                        )}
                        {inst.country && (
                          <p className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {inst.country}
                          </p>
                        )}
                        {inst.counterCustomerId && (
                          <p className="flex items-center gap-1">
                            <Shield className="h-3 w-3" /> COUNTER: {inst.counterCustomerId}
                          </p>
                        )}
                        <p className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> {inst.userCount} user(s)
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      {inst.plan === "TRANSFORMATIVE" && (
                        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                          <p className="font-display text-lg font-semibold text-primary">
                            {inst.apcUsed}/{inst.apcQuota}
                          </p>
                          <p className="text-[0.65rem] text-muted-foreground">APC quota used</p>
                        </div>
                      )}
                      {inst.currentPeriodEnd && (
                        <p className="mt-2 text-[0.65rem] text-muted-foreground">
                          Renews {new Date(inst.currentPeriodEnd).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <Separator className="my-3" />
                  <div>
                    <p className="eyebrow mb-1">IP ranges (CIDR)</p>
                    <div className="flex flex-wrap gap-1">
                      {inst.ipRanges.split(",").map((r, i) => (
                        <code key={i} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.65rem]">
                          {r.trim()}
                        </code>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card className="paper-card bg-muted/30">
        <CardContent className="p-5 text-xs text-muted-foreground">
          <p className="font-display text-sm font-semibold text-foreground">
            How institutional IP authentication works
          </p>
          <p className="mt-1">
            Every request to a full-text galley passes through the API Gateway. The gateway
            extracts the client IP, checks it against all registered institutions' CIDR ranges,
            and grants access if the IP matches — no login required. For remote users, the
            domain of their email address is checked as a fallback. COUNTER 5 reports are
            automatically sliced by <code className="font-mono">institutionId</code> so each
            library sees only its own usage.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
