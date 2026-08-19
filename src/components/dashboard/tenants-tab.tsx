"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Globe,
  Loader2,
  Plus,
  CheckCircle2,
  Clock,
  Trash2,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Copy,
  Activity,
  AlertTriangle,
  Wallet,
} from "lucide-react";
import { TENANT_PLANS, TENANT_PLAN_KEYS, ALL_MODULE_KEYS, MODULE_LABELS } from "@/lib/tenant-plans";

interface TenantDomain {
  id: string;
  hostname: string;
  isPrimary: boolean;
  verified: boolean;
  vercelAdded: boolean;
  verificationToken: string | null;
  createdAt: string;
}

interface Tenant {
  id: string;
  slug: string;
  name: string;
  status: string;
  isPlatform: boolean;
  maxUsers: number | null;
  plan: string | null;
  pricePerYear: number | null;
  billingOwnerId: string | null;
  entitlements: Record<string, boolean>;
  domainCount: number;
  userCount: number;
  domains: TenantDomain[];
}

interface TenantHealth {
  tenant: { id: string; slug: string; name: string; status: string; isPlatform: boolean };
  quota: { maxUsers: number | null; userCount: number; usagePercent: number | null };
  content: { books: number; magazines: number; podcasts: number; mediaPosts: number; collections: number; articles: number; issues: number };
  domains: { hostname: string; isPrimary: boolean; verified: boolean; vercelAdded: boolean }[];
}

interface PurgeBlockers {
  books: { id: string; title: string; reason: string }[];
  magazines: { id: string; name: string; reason: string }[];
  journals: { id: string; name: string; reason: string }[];
}

/**
 * SUPER_ADMIN-only tenant + custom domain management (Whitelabel Phase 3).
 * Creates tenants, adds custom domains, runs the DNS TXT verification
 * challenge, and reports Vercel SSL-provisioning status — all against the
 * platform-level /api/admin/tenants API (there's no tenant-scoped admin
 * role yet; that's Phase 4).
 */
export function TenantsTab() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newHostname, setNewHostname] = useState<Record<string, string>>({});
  const [addingDomainFor, setAddingDomainFor] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [maxUsersInput, setMaxUsersInput] = useState<Record<string, string>>({});
  const [savingQuotaFor, setSavingQuotaFor] = useState<string | null>(null);
  const [planInput, setPlanInput] = useState<Record<string, string>>({});
  const [priceInput, setPriceInput] = useState<Record<string, string>>({});
  const [billingOwnerInput, setBillingOwnerInput] = useState<Record<string, string>>({});
  const [savingPlanFor, setSavingPlanFor] = useState<string | null>(null);
  const [togglingModuleFor, setTogglingModuleFor] = useState<string | null>(null);
  const [health, setHealth] = useState<Record<string, TenantHealth>>({});
  const [loadingHealthFor, setLoadingHealthFor] = useState<string | null>(null);
  const [purgeConfirm, setPurgeConfirm] = useState<Record<string, string>>({});
  const [purgingId, setPurgingId] = useState<string | null>(null);
  const [purgeBlockers, setPurgeBlockers] = useState<Record<string, PurgeBlockers>>({});
  const [forceCascade, setForceCascade] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch<{ tenants: Tenant[] }>("/api/admin/tenants");
      setTenants(res.tenants);
    } catch (e: any) {
      toast.error(e.message || "Failed to load tenants");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createTenant() {
    if (!newSlug.trim() || !newName.trim()) {
      toast.error("Slug and name are required");
      return;
    }
    setCreating(true);
    try {
      await apiFetch("/api/admin/tenants", {
        method: "POST",
        body: JSON.stringify({ slug: newSlug.trim(), name: newName.trim() }),
      });
      toast.success(`Tenant "${newName}" created`);
      setNewSlug("");
      setNewName("");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to create tenant");
    } finally {
      setCreating(false);
    }
  }

  async function addDomain(tenantId: string) {
    const hostname = (newHostname[tenantId] || "").trim();
    if (!hostname) {
      toast.error("Enter a hostname");
      return;
    }
    setAddingDomainFor(tenantId);
    try {
      await apiFetch(`/api/admin/tenants/${tenantId}/domains`, {
        method: "POST",
        body: JSON.stringify({ hostname }),
      });
      toast.success(`Added "${hostname}" — publish the TXT record shown below, then click Verify.`);
      setNewHostname((prev) => ({ ...prev, [tenantId]: "" }));
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to add domain");
    } finally {
      setAddingDomainFor(null);
    }
  }

  async function verifyDomain(tenantId: string, domainId: string) {
    setVerifyingId(domainId);
    try {
      const res = await apiFetch<{ verified: boolean; vercel?: { ok: boolean; note?: string } }>(
        `/api/admin/tenants/${tenantId}/domains/${domainId}/verify`,
        { method: "POST" }
      );
      if (res.vercel?.ok) {
        toast.success("Domain verified and added to Vercel — SSL will provision automatically.");
      } else {
        toast.success(`Domain verified. ${res.vercel?.note || "Add it to the Vercel project manually for SSL."}`);
      }
      await load();
    } catch (e: any) {
      toast.error(e.message || "Verification failed");
    } finally {
      setVerifyingId(null);
    }
  }

  async function removeDomain(tenantId: string, domainId: string) {
    setRemovingId(domainId);
    try {
      await apiFetch(`/api/admin/tenants/${tenantId}/domains/${domainId}`, { method: "DELETE" });
      toast.success("Domain removed");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to remove domain");
    } finally {
      setRemovingId(null);
    }
  }

  function copyToken(token: string) {
    navigator.clipboard.writeText(token);
    toast.success("Token copied");
  }

  async function saveQuota(tenantId: string) {
    const raw = (maxUsersInput[tenantId] ?? "").trim();
    if (raw !== "" && (!/^\d+$/.test(raw) || Number(raw) < 0)) {
      toast.error("Seat limit must be a non-negative whole number, or blank for unlimited");
      return;
    }
    setSavingQuotaFor(tenantId);
    try {
      await apiFetch(`/api/admin/tenants/${tenantId}`, {
        method: "PATCH",
        body: JSON.stringify({ maxUsers: raw === "" ? null : Number(raw) }),
      });
      toast.success(raw === "" ? "Seat limit cleared — unlimited" : `Seat limit set to ${raw}`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to update seat limit");
    } finally {
      setSavingQuotaFor(null);
    }
  }

  async function savePlan(tenant: Tenant) {
    const plan = planInput[tenant.id] ?? tenant.plan ?? "";
    const priceRaw = (priceInput[tenant.id] ?? (tenant.pricePerYear != null ? String(tenant.pricePerYear) : "")).trim();
    const billingOwnerRaw = (billingOwnerInput[tenant.id] ?? tenant.billingOwnerId ?? "").trim();
    if (priceRaw !== "" && (!/^\d+(\.\d{1,2})?$/.test(priceRaw) || Number(priceRaw) < 0)) {
      toast.error("Price per year must be a non-negative number");
      return;
    }
    setSavingPlanFor(tenant.id);
    try {
      await apiFetch(`/api/admin/tenants/${tenant.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          plan: plan === "" ? null : plan,
          pricePerYear: priceRaw === "" ? null : Number(priceRaw),
          billingOwnerId: billingOwnerRaw === "" ? null : billingOwnerRaw,
        }),
      });
      toast.success(plan === "" ? "Plan cleared — every module ungated" : `Plan set to ${TENANT_PLANS[plan]?.label ?? plan}`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to update plan");
    } finally {
      setSavingPlanFor(null);
    }
  }

  async function toggleModule(tenantId: string, moduleKey: string, enabled: boolean) {
    setTogglingModuleFor(`${tenantId}:${moduleKey}`);
    try {
      await apiFetch(`/api/admin/tenants/${tenantId}/entitlements`, {
        method: "PATCH",
        body: JSON.stringify({ moduleKey, enabled }),
      });
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to update entitlement");
    } finally {
      setTogglingModuleFor(null);
    }
  }

  async function loadHealth(tenantId: string) {
    setLoadingHealthFor(tenantId);
    try {
      const res = await apiFetch<TenantHealth>(`/api/admin/tenants/${tenantId}/health`);
      setHealth((prev) => ({ ...prev, [tenantId]: res }));
    } catch (e: any) {
      toast.error(e.message || "Failed to load tenant health");
    } finally {
      setLoadingHealthFor(null);
    }
  }

  async function purgeTenant(tenant: Tenant) {
    const confirmSlug = (purgeConfirm[tenant.id] ?? "").trim();
    if (confirmSlug !== tenant.slug) {
      toast.error(`Type "${tenant.slug}" to confirm`);
      return;
    }
    setPurgingId(tenant.id);
    setPurgeBlockers((prev) => {
      const next = { ...prev };
      delete next[tenant.id];
      return next;
    });
    try {
      const res = await apiFetch<{ purged: Record<string, number> }>(`/api/admin/tenants/${tenant.id}/purge`, {
        method: "DELETE",
        body: JSON.stringify({ confirmSlug, confirmDestructiveCascade: !!forceCascade[tenant.id] }),
      });
      const parts = Object.entries(res.purged).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`);
      toast.success(`Tenant "${tenant.name}" purged${parts.length ? ` (${parts.join(", ")})` : ""}`);
      setExpanded(null);
      await load();
    } catch (e: any) {
      // The purge endpoint reports content it deliberately won't destroy
      // automatically (Books with distribution/royalty history, Journals
      // with articles/issues) as structured blockers on a 409 rather than
      // just an error string — surface those so the caller knows exactly
      // what to remove or migrate first, not just that purge failed.
      if (e.body?.blockers) {
        setPurgeBlockers((prev) => ({ ...prev, [tenant.id]: e.body.blockers }));
        toast.error("This tenant has content that needs to be removed or migrated first");
      } else {
        toast.error(e.message || "Purge failed");
      }
    } finally {
      setPurgingId(null);
    }
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
      <Card className="paper-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <p className="eyebrow">New tenant</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Creates an isolated tenant with its own branding and, once a custom domain is verified
            below, its own hostname.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="newSlug">Slug</Label>
              <Input id="newSlug" placeholder="harvard" value={newSlug} onChange={(e) => setNewSlug(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newName">Name</Label>
              <Input id="newName" placeholder="Harvard University Press" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <Button onClick={createTenant} disabled={creating}>
              {creating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
              Create
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="paper-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <p className="eyebrow">{tenants.length} tenant{tenants.length === 1 ? "" : "s"}</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tenants.map((t) => (
              <div key={t.id} className="rounded-md border border-border">
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {expanded === t.id ? (
                      <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-semibold">{t.name}</h3>
                        {t.isPlatform && (
                          <Badge variant="outline" className="border-primary/30 bg-primary/5 text-[0.6rem] text-primary">
                            PLATFORM
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`text-[0.6rem] ${
                            t.status === "ACTIVE"
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : "border-amber-300 bg-amber-50 text-amber-700"
                          }`}
                        >
                          {t.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t.slug} · {t.domainCount} domain{t.domainCount === 1 ? "" : "s"} · {t.userCount} user{t.userCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                </button>

                {expanded === t.id && (
                  <div className="border-t border-border p-4 pt-3">
                    <div className="space-y-2">
                      {t.domains.length === 0 && (
                        <p className="text-xs text-muted-foreground">No domains yet.</p>
                      )}
                      {t.domains.map((d) => (
                        <div key={d.id} className="rounded-md border border-border/70 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <code className="font-mono text-xs">{d.hostname}</code>
                              {d.isPrimary && (
                                <Badge variant="outline" className="text-[0.6rem]">
                                  primary
                                </Badge>
                              )}
                              {d.verified ? (
                                <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[0.6rem] text-emerald-700">
                                  <CheckCircle2 className="mr-1 h-3 w-3" /> verified
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[0.6rem] text-amber-700">
                                  <Clock className="mr-1 h-3 w-3" /> pending
                                </Badge>
                              )}
                              {d.verified && (
                                <Badge
                                  variant="outline"
                                  className={`text-[0.6rem] ${
                                    d.vercelAdded
                                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                      : "border-stone-300 bg-stone-100 text-stone-700"
                                  }`}
                                >
                                  {d.vercelAdded ? "SSL provisioning" : "SSL not configured"}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {!d.verified && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[0.7rem]"
                                  disabled={verifyingId === d.id}
                                  onClick={() => verifyDomain(t.id, d.id)}
                                >
                                  {verifyingId === d.id && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                                  Verify
                                </Button>
                              )}
                              {!d.isPrimary && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-destructive"
                                  disabled={removingId === d.id}
                                  onClick={() => removeDomain(t.id, d.id)}
                                >
                                  {removingId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                </Button>
                              )}
                            </div>
                          </div>
                          {!d.verified && d.verificationToken && (
                            <div className="mt-2 rounded bg-muted/50 p-2 text-[0.7rem]">
                              <p className="text-muted-foreground">
                                Add a TXT record at <code className="font-mono">_ep-verify.{d.hostname}</code> with this value:
                              </p>
                              <div className="mt-1 flex items-center gap-1.5">
                                <code className="flex-1 truncate rounded bg-background px-1.5 py-1 font-mono">{d.verificationToken}</code>
                                <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => copyToken(d.verificationToken!)}>
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                              <p className="mt-1 text-muted-foreground">
                                Then point the domain at Vercel (CNAME → cname.vercel-dns.com, or A → 76.76.21.21 for an apex domain).
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <Separator className="my-3" />

                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-[220px] flex-1 space-y-1.5">
                        <Label htmlFor={`domain-${t.id}`} className="text-xs">
                          Add custom domain
                        </Label>
                        <Input
                          id={`domain-${t.id}`}
                          placeholder="journals.example.edu"
                          value={newHostname[t.id] || ""}
                          onChange={(e) => setNewHostname((prev) => ({ ...prev, [t.id]: e.target.value }))}
                        />
                      </div>
                      <Button
                        size="sm"
                        disabled={addingDomainFor === t.id}
                        onClick={() => addDomain(t.id)}
                      >
                        {addingDomainFor === t.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
                        Add
                      </Button>
                    </div>

                    <Separator className="my-3" />

                    <div className="space-y-1.5">
                      <p className="eyebrow">Seat limit</p>
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-[140px] space-y-1.5">
                          <Label htmlFor={`maxusers-${t.id}`} className="text-xs">
                            Max users (blank = unlimited)
                          </Label>
                          <Input
                            id={`maxusers-${t.id}`}
                            type="number"
                            min={0}
                            placeholder={t.maxUsers == null ? "Unlimited" : String(t.maxUsers)}
                            value={maxUsersInput[t.id] ?? (t.maxUsers == null ? "" : String(t.maxUsers))}
                            onChange={(e) => setMaxUsersInput((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={savingQuotaFor === t.id}
                          onClick={() => saveQuota(t.id)}
                        >
                          {savingQuotaFor === t.id && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                          Save
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Currently {t.userCount} user{t.userCount === 1 ? "" : "s"}
                          {t.maxUsers != null ? ` of ${t.maxUsers}` : " (no cap)"}.
                        </p>
                      </div>
                    </div>

                    <Separator className="my-3" />

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-3.5 w-3.5 text-primary" />
                        <p className="eyebrow">Plan &amp; billing</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="space-y-1.5">
                          <Label htmlFor={`plan-${t.id}`} className="text-xs">
                            Plan
                          </Label>
                          <select
                            id={`plan-${t.id}`}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={planInput[t.id] ?? t.plan ?? ""}
                            onChange={(e) => setPlanInput((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          >
                            <option value="">No plan (ungated)</option>
                            {TENANT_PLAN_KEYS.map((key) => (
                              <option key={key} value={key}>
                                {TENANT_PLANS[key].label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`price-${t.id}`} className="text-xs">
                            Price / year (USD)
                          </Label>
                          <Input
                            id={`price-${t.id}`}
                            type="number"
                            min={0}
                            placeholder={t.pricePerYear != null ? String(t.pricePerYear) : "—"}
                            value={priceInput[t.id] ?? (t.pricePerYear != null ? String(t.pricePerYear) : "")}
                            onChange={(e) => setPriceInput((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`billing-owner-${t.id}`} className="text-xs">
                            Billing owner user ID
                          </Label>
                          <Input
                            id={`billing-owner-${t.id}`}
                            placeholder={t.billingOwnerId || "—"}
                            value={billingOwnerInput[t.id] ?? (t.billingOwnerId || "")}
                            onChange={(e) => setBillingOwnerInput((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          />
                        </div>
                      </div>
                      {(() => {
                        const selectedPlan = planInput[t.id] ?? t.plan ?? "";
                        const catalogPlan = selectedPlan ? TENANT_PLANS[selectedPlan] : null;
                        return catalogPlan ? (
                          <p className="text-xs text-muted-foreground">
                            Catalog range: ${catalogPlan.priceRangeUsd[0].toLocaleString()}–${catalogPlan.priceRangeUsd[1].toLocaleString()}/yr
                          </p>
                        ) : null;
                      })()}
                      <Button size="sm" variant="outline" disabled={savingPlanFor === t.id} onClick={() => savePlan(t)}>
                        {savingPlanFor === t.id && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        Save plan
                      </Button>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {ALL_MODULE_KEYS.map((moduleKey) => {
                          const enabled = t.entitlements[moduleKey] !== false;
                          const busy = togglingModuleFor === `${t.id}:${moduleKey}`;
                          return (
                            <button
                              key={moduleKey}
                              type="button"
                              disabled={busy}
                              onClick={() => toggleModule(t.id, moduleKey, !enabled)}
                              className={`rounded-full border px-2.5 py-1 text-[0.65rem] transition-colors ${
                                enabled
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                  : "border-stone-300 bg-stone-100 text-stone-500"
                              }`}
                              title={enabled ? "Click to revoke" : "Click to grant"}
                            >
                              {busy && <Loader2 className="mr-1 inline h-2.5 w-2.5 animate-spin" />}
                              {MODULE_LABELS[moduleKey]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <Separator className="my-3" />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="eyebrow">Health</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[0.7rem]"
                          disabled={loadingHealthFor === t.id}
                          onClick={() => loadHealth(t.id)}
                        >
                          {loadingHealthFor === t.id ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <Activity className="mr-1 h-3 w-3" />
                          )}
                          {health[t.id] ? "Refresh" : "Check"}
                        </Button>
                      </div>
                      {health[t.id] && (
                        <div className="grid gap-1.5 rounded-md border border-border/70 p-3 text-xs sm:grid-cols-2">
                          <p>
                            Seats: {health[t.id].quota.userCount}
                            {health[t.id].quota.maxUsers != null
                              ? ` / ${health[t.id].quota.maxUsers} (${health[t.id].quota.usagePercent}%)`
                              : " (unlimited)"}
                          </p>
                          <p>Domains: {health[t.id].domains.filter((d) => d.verified).length} verified of {health[t.id].domains.length}</p>
                          <p>
                            Content: {health[t.id].content.books} books · {health[t.id].content.magazines} magazines ·{" "}
                            {health[t.id].content.podcasts} podcasts · {health[t.id].content.mediaPosts} posts ·{" "}
                            {health[t.id].content.collections} collections
                          </p>
                          <p>
                            Editorial: {health[t.id].content.articles} articles · {health[t.id].content.issues} issues
                          </p>
                        </div>
                      )}
                    </div>

                    {!t.isPlatform && (
                      <>
                        <Separator className="my-3" />
                        <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                            <p className="eyebrow text-destructive">Purge tenant</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Permanently deletes this tenant along with its safe-to-remove content (media posts,
                            collections, empty magazines/podcasts/journals). Books with distribution or royalty
                            history, journals with articles, and magazines with issues are never deleted
                            automatically — remove those first, or opt into the destructive option below.
                            Requires zero users on the tenant.
                          </p>
                          {purgeBlockers[t.id] && (
                            <div className="space-y-2 rounded bg-background/60 p-2 text-xs">
                              {purgeBlockers[t.id].books.map((b) => (
                                <p key={b.id}>Book "{b.title}" — {b.reason}</p>
                              ))}
                              {purgeBlockers[t.id].magazines.map((m) => (
                                <p key={m.id}>Magazine "{m.name}" — {m.reason}</p>
                              ))}
                              {purgeBlockers[t.id].journals.map((j) => (
                                <p key={j.id}>Journal "{j.name}" — {j.reason}</p>
                              ))}
                              <label className="flex items-start gap-1.5 border-t border-border/50 pt-2 text-destructive">
                                <input
                                  type="checkbox"
                                  className="mt-0.5"
                                  checked={!!forceCascade[t.id]}
                                  onChange={(e) => setForceCascade((prev) => ({ ...prev, [t.id]: e.target.checked }))}
                                />
                                <span>
                                  Also permanently delete the books/magazines/journal content listed above,
                                  including all articles, issues, reviews, and royalty/distribution history. This
                                  cannot be undone.
                                </span>
                              </label>
                            </div>
                          )}
                          <div className="flex flex-wrap items-end gap-2">
                            <div className="min-w-[160px] space-y-1.5">
                              <Label htmlFor={`purge-${t.id}`} className="text-xs">
                                Type "{t.slug}" to confirm
                              </Label>
                              <Input
                                id={`purge-${t.id}`}
                                value={purgeConfirm[t.id] || ""}
                                onChange={(e) => setPurgeConfirm((prev) => ({ ...prev, [t.id]: e.target.value }))}
                              />
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={purgingId === t.id || purgeConfirm[t.id] !== t.slug}
                              onClick={() => purgeTenant(t)}
                            >
                              {purgingId === t.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
                              Purge
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
