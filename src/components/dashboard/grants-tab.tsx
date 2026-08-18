"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Landmark, Loader2, Plus, Trash2, Coins } from "lucide-react";

interface Funder {
  id: string;
  name: string;
  externalId: string | null;
  country: string | null;
  website: string | null;
  grantCount: number;
}

interface Grant {
  id: string;
  title: string;
  awardNumber: string | null;
  amount: number | null;
  currency: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  funder: { id: string; name: string } | null;
  funderNameFreeText: string | null;
  department: { id: string; name: string; slug: string } | null;
  article: { id: string; title: string } | null;
  principalInvestigator: { id: string; fullName: string; email: string } | null;
}

const GRANT_STATUSES = ["ACTIVE", "COMPLETED", "CLOSED"];

const STATUS_VARIANT: Record<string, "default" | "outline" | "destructive"> = {
  ACTIVE: "default",
  COMPLETED: "outline",
  CLOSED: "destructive",
};

/**
 * EP University OS Phase 4 — funder registry + grants-office record
 * keeping. Visible to TENANT_SCOPED_ADMIN_ROLES only. Mirrors
 * DepartmentsTab's create-form-plus-list structure, doubled for the two
 * related resources (a Grant optionally references a Funder).
 */
export function GrantsTab() {
  const [funders, setFunders] = useState<Funder[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);

  const [newFunderName, setNewFunderName] = useState("");
  const [newFunderExternalId, setNewFunderExternalId] = useState("");
  const [creatingFunder, setCreatingFunder] = useState(false);

  const [newGrantTitle, setNewGrantTitle] = useState("");
  const [newGrantAward, setNewGrantAward] = useState("");
  const [newGrantFunderId, setNewGrantFunderId] = useState("");
  const [newGrantFunderFreeText, setNewGrantFunderFreeText] = useState("");
  const [newGrantAmount, setNewGrantAmount] = useState("");
  const [newGrantCurrency, setNewGrantCurrency] = useState("");
  const [newGrantPI, setNewGrantPI] = useState("");
  const [creatingGrant, setCreatingGrant] = useState(false);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingFunderId, setDeletingFunderId] = useState<string | null>(null);
  const [deletingGrantId, setDeletingGrantId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [fundersRes, grantsRes] = await Promise.all([
        apiFetch<{ funders: Funder[] }>("/api/admin/funders"),
        apiFetch<{ grants: Grant[] }>("/api/admin/grants"),
      ]);
      setFunders(fundersRes.funders);
      setGrants(grantsRes.grants);
    } catch (e: any) {
      toast.error(e.message || "Failed to load grants data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createFunder() {
    if (!newFunderName.trim()) {
      toast.error("Funder name is required");
      return;
    }
    setCreatingFunder(true);
    try {
      await apiFetch("/api/admin/funders", {
        method: "POST",
        body: JSON.stringify({
          name: newFunderName.trim(),
          externalId: newFunderExternalId.trim() || undefined,
        }),
      });
      toast.success(`Funder "${newFunderName}" added`);
      setNewFunderName("");
      setNewFunderExternalId("");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to add funder");
    } finally {
      setCreatingFunder(false);
    }
  }

  async function deleteFunder(f: Funder) {
    setDeletingFunderId(f.id);
    try {
      await apiFetch(`/api/admin/funders/${f.id}`, { method: "DELETE" });
      toast.success(`Funder "${f.name}" removed`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to remove funder");
    } finally {
      setDeletingFunderId(null);
    }
  }

  async function createGrant() {
    if (!newGrantTitle.trim()) {
      toast.error("Grant title is required");
      return;
    }
    setCreatingGrant(true);
    try {
      await apiFetch("/api/admin/grants", {
        method: "POST",
        body: JSON.stringify({
          title: newGrantTitle.trim(),
          awardNumber: newGrantAward.trim() || undefined,
          funderId: newGrantFunderId || undefined,
          funderNameFreeText: newGrantFunderId ? undefined : newGrantFunderFreeText.trim() || undefined,
          amount: newGrantAmount.trim() ? Number(newGrantAmount) : undefined,
          currency: newGrantCurrency.trim() || undefined,
          principalInvestigatorUserId: newGrantPI.trim() || undefined,
        }),
      });
      toast.success(`Grant "${newGrantTitle}" created`);
      setNewGrantTitle("");
      setNewGrantAward("");
      setNewGrantFunderId("");
      setNewGrantFunderFreeText("");
      setNewGrantAmount("");
      setNewGrantCurrency("");
      setNewGrantPI("");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to create grant");
    } finally {
      setCreatingGrant(false);
    }
  }

  async function updateGrantStatus(g: Grant, status: string) {
    setUpdatingId(g.id);
    try {
      await apiFetch(`/api/admin/grants/${g.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      toast.success(`Grant marked ${status.toLowerCase()}`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to update grant");
    } finally {
      setUpdatingId(null);
    }
  }

  async function deleteGrant(g: Grant) {
    setDeletingGrantId(g.id);
    try {
      await apiFetch(`/api/admin/grants/${g.id}`, { method: "DELETE" });
      toast.success(`Grant "${g.title}" deleted`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete grant");
    } finally {
      setDeletingGrantId(null);
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
            <Landmark className="h-4 w-4 text-primary" />
            <p className="eyebrow">Funder registry — {funders.length} funder{funders.length === 1 ? "" : "s"}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            A curated list of funding bodies for this tenant. Separate from a submitted article's own funder
            statement (captured at submission for Crossref deposit) — this registry backs structured grant records
            below.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="newFunderName">Name</Label>
              <Input id="newFunderName" placeholder="National Science Foundation" value={newFunderName} onChange={(e) => setNewFunderName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newFunderExternalId">Funder Registry ID / ROR (optional)</Label>
              <Input id="newFunderExternalId" placeholder="https://ror.org/..." value={newFunderExternalId} onChange={(e) => setNewFunderExternalId(e.target.value)} />
            </div>
            <Button onClick={createFunder} disabled={creatingFunder}>
              {creatingFunder ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
              Add
            </Button>
          </div>
          {funders.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {funders.map((f) => (
                <Badge key={f.id} variant="outline" className="gap-1.5 py-1 text-[0.65rem]">
                  {f.name}
                  {f.grantCount > 0 && <span className="text-muted-foreground">· {f.grantCount}</span>}
                  <button
                    type="button"
                    disabled={deletingFunderId === f.id}
                    onClick={() => deleteFunder(f)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${f.name}`}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="paper-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary" />
            <p className="eyebrow">New grant</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="newGrantTitle">Title</Label>
              <Input id="newGrantTitle" placeholder="Grant title" value={newGrantTitle} onChange={(e) => setNewGrantTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newGrantAward">Award number (optional)</Label>
              <Input id="newGrantAward" value={newGrantAward} onChange={(e) => setNewGrantAward(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="newGrantFunder">Funder</Label>
              <select
                id="newGrantFunder"
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
                value={newGrantFunderId}
                onChange={(e) => setNewGrantFunderId(e.target.value)}
              >
                <option value="">— not in registry —</option>
                {funders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            {!newGrantFunderId && (
              <div className="space-y-1.5">
                <Label htmlFor="newGrantFunderFreeText">Funder name (free text, optional)</Label>
                <Input id="newGrantFunderFreeText" value={newGrantFunderFreeText} onChange={(e) => setNewGrantFunderFreeText(e.target.value)} />
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="newGrantAmount">Amount (optional)</Label>
              <Input id="newGrantAmount" type="number" min="0" value={newGrantAmount} onChange={(e) => setNewGrantAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newGrantCurrency">Currency (optional)</Label>
              <Input id="newGrantCurrency" placeholder="USD" maxLength={3} value={newGrantCurrency} onChange={(e) => setNewGrantCurrency(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newGrantPI">Principal investigator (user id, optional)</Label>
              <Input id="newGrantPI" placeholder="user id" value={newGrantPI} onChange={(e) => setNewGrantPI(e.target.value)} />
            </div>
          </div>
          <Button onClick={createGrant} disabled={creatingGrant}>
            {creatingGrant ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
            Create grant
          </Button>
        </CardContent>
      </Card>

      <Card className="paper-card">
        <CardHeader className="pb-3">
          <p className="eyebrow">{grants.length} grant{grants.length === 1 ? "" : "s"}</p>
        </CardHeader>
        <CardContent>
          {grants.length === 0 ? (
            <p className="text-xs text-muted-foreground">No grants recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {grants.map((g) => (
                <div key={g.id} className="rounded-md border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-semibold">{g.title}</h3>
                        <Badge variant={STATUS_VARIANT[g.status] || "outline"} className="text-[0.6rem]">
                          {g.status}
                        </Badge>
                        {g.awardNumber && (
                          <Badge variant="outline" className="text-[0.6rem]">
                            {g.awardNumber}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {(g.funder?.name || g.funderNameFreeText) && `Funder: ${g.funder?.name || g.funderNameFreeText}`}
                        {g.amount != null ? ` · ${g.currency || ""} ${g.amount.toLocaleString()}` : ""}
                        {g.principalInvestigator ? ` · PI: ${g.principalInvestigator.fullName}` : ""}
                        {g.department ? ` · ${g.department.name}` : ""}
                        {g.article ? ` · re: ${g.article.title}` : ""}
                      </p>
                      {g.notes && <p className="mt-1 text-xs text-foreground/80">{g.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="border-input h-8 rounded-md border bg-transparent px-2 text-xs shadow-xs"
                        value={g.status}
                        disabled={updatingId === g.id}
                        onChange={(e) => updateGrantStatus(g, e.target.value)}
                      >
                        {GRANT_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-destructive"
                        disabled={deletingGrantId === g.id}
                        onClick={() => deleteGrant(g)}
                      >
                        {deletingGrantId === g.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
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
