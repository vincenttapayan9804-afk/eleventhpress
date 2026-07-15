"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useApp } from "@/lib/store";
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
  Key,
  Copy,
  Eye,
  EyeOff,
} from "lucide-react";

interface Institution {
  id: string;
  name: string;
  domain: string | null;
  country: string | null;
  ipRanges: string;
  rorId: string | null;
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  apcQuota: number;
  apcUsed: number;
  counterCustomerId: string | null;
  counterApiKey: string | null;
  userCount: number;
  datasetCount: number;
}

export function InstitutionsTab() {
  const user = useApp((s) => s.user);
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [ipMatch, setIpMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [revealedKeyId, setRevealedKeyId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

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

  async function regenerateKey(id: string) {
    setRegeneratingId(id);
    try {
      const res = await apiFetch<{ counterApiKey: string }>(`/api/institutions/${id}/counter-key`, {
        method: "POST",
      });
      setInstitutions((prev) => prev.map((i) => (i.id === id ? { ...i, counterApiKey: res.counterApiKey } : i)));
      setRevealedKeyId(id);
      toast.success("SUSHI API key regenerated — the previous key no longer works.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRegeneratingId(null);
    }
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    toast.success("API key copied");
  }

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
                        {inst.rorId && (
                          <p className="flex items-center gap-1">
                            <Network className="h-3 w-3" />
                            <a
                              href={`https://ror.org/${inst.rorId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="underline decoration-dotted underline-offset-2 hover:text-primary"
                            >
                              ROR: {inst.rorId}
                            </a>
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

                  {/* SUSHI API key — SUPER_ADMIN only, matches the key's
                      read access in GET /api/institutions/list. Required to
                      pull this institution's own COUNTER5 report; without
                      it a librarian can no longer read another institution's
                      usage by guessing a customer_id. */}
                  {isSuperAdmin && (
                    <>
                      <Separator className="my-3" />
                      <div>
                        <p className="eyebrow mb-1 flex items-center gap-1">
                          <Key className="h-3 w-3" /> SUSHI API key
                        </p>
                        {inst.counterApiKey ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.65rem]">
                              {revealedKeyId === inst.id ? inst.counterApiKey : "•".repeat(24)}
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5"
                              onClick={() => setRevealedKeyId(revealedKeyId === inst.id ? null : inst.id)}
                            >
                              {revealedKeyId === inst.id ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5"
                              onClick={() => copyKey(inst.counterApiKey!)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <p className="text-[0.65rem] text-muted-foreground">No key set — regenerate to create one.</p>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-1.5 h-6 px-2 text-[0.65rem]"
                          disabled={regeneratingId === inst.id}
                          onClick={() => regenerateKey(inst.id)}
                        >
                          {regeneratingId === inst.id ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-1 h-3 w-3" />
                          )}
                          Regenerate
                        </Button>
                      </div>
                    </>
                  )}
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
            How institutional usage attribution works
          </p>
          <p className="mt-1">
            Every published-article view checks the requester's IP against all registered
            institutions' CIDR ranges, with the signed-in user's email domain as a fallback —
            this attributes real usage to an institution for COUNTER 5 reporting, it does not
            gate access (every article is already open access, no login required to read it).
            A matched view is recorded as a real usage event tagged with that institution's
            COUNTER customer ID, so a library's own SUSHI report — retrieved with its own API
            key, shown above for admins — reflects genuine per-institution usage instead of
            platform-wide totals.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
