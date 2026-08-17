"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { GraduationCap, Loader2, Plus, Trash2, Users2 } from "lucide-react";

interface Department {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  headUserId: string | null;
  head: { id: string; fullName: string; email: string } | null;
  parentDepartmentId: string | null;
  memberCount: number;
  childCount: number;
  createdAt: string;
}

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

/**
 * EP University OS Phase 1 — tenant-scoped department management. Visible
 * to SUPER_ADMIN (across every tenant) and TENANT_ADMIN (confined to their
 * own tenant by /api/admin/departments itself) — unlike TenantsTab, this is
 * meant to be self-serve for a university's own admin.
 */
export function DepartmentsTab() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [newHeadUserId, setNewHeadUserId] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<Record<string, { members: number; childDepartments: number }>>({});

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch<{ departments: Department[] }>("/api/admin/departments");
      setDepartments(res.departments);
    } catch (e: any) {
      toast.error(e.message || "Failed to load departments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createDepartment() {
    if (!newName.trim() || !newSlug.trim()) {
      toast.error("Name and slug are required");
      return;
    }
    setCreating(true);
    try {
      await apiFetch("/api/admin/departments", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          slug: newSlug.trim(),
          headUserId: newHeadUserId.trim() || undefined,
        }),
      });
      toast.success(`Department "${newName}" created`);
      setNewName("");
      setNewSlug("");
      setNewHeadUserId("");
      setSlugTouched(false);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to create department");
    } finally {
      setCreating(false);
    }
  }

  async function deleteDepartment(d: Department) {
    setDeletingId(d.id);
    setBlockers((prev) => {
      const next = { ...prev };
      delete next[d.id];
      return next;
    });
    try {
      await apiFetch(`/api/admin/departments/${d.id}`, { method: "DELETE" });
      toast.success(`Department "${d.name}" deleted`);
      await load();
    } catch (e: any) {
      if (e.body?.blockers) {
        setBlockers((prev) => ({ ...prev, [d.id]: e.body.blockers }));
        toast.error("This department has members or sub-departments — remove those first");
      } else {
        toast.error(e.message || "Failed to delete department");
      }
    } finally {
      setDeletingId(null);
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
            <GraduationCap className="h-4 w-4 text-primary" />
            <p className="eyebrow">New department</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Departments are an org/roster grouping for your tenant's faculty and students — they don't yet own or
            scope any editorial content.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="newDeptName">Name</Label>
              <Input
                id="newDeptName"
                placeholder="Biology"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (!slugTouched) setNewSlug(slugify(e.target.value));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newDeptSlug">Slug</Label>
              <Input
                id="newDeptSlug"
                placeholder="biology"
                value={newSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setNewSlug(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newDeptHead">Head (user id, optional)</Label>
              <Input id="newDeptHead" placeholder="user id" value={newHeadUserId} onChange={(e) => setNewHeadUserId(e.target.value)} />
            </div>
            <Button onClick={createDepartment} disabled={creating}>
              {creating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
              Create
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="paper-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users2 className="h-4 w-4 text-primary" />
            <p className="eyebrow">{departments.length} department{departments.length === 1 ? "" : "s"}</p>
          </div>
        </CardHeader>
        <CardContent>
          {departments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No departments yet.</p>
          ) : (
            <div className="space-y-3">
              {departments.map((d) => (
                <div key={d.id} className="rounded-md border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-semibold">{d.name}</h3>
                        <Badge variant="outline" className="text-[0.6rem]">
                          {d.slug}
                        </Badge>
                        {d.parentDepartmentId && (
                          <Badge variant="outline" className="text-[0.6rem]">
                            sub-department
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {d.memberCount} member{d.memberCount === 1 ? "" : "s"}
                        {d.childCount > 0 ? ` · ${d.childCount} sub-department${d.childCount === 1 ? "" : "s"}` : ""}
                        {d.head ? ` · Head: ${d.head.fullName}` : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-destructive"
                      disabled={deletingId === d.id}
                      onClick={() => deleteDepartment(d)}
                    >
                      {deletingId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  {blockers[d.id] && (
                    <p className="mt-2 text-xs text-destructive">
                      Has {blockers[d.id].members} member{blockers[d.id].members === 1 ? "" : "s"} and{" "}
                      {blockers[d.id].childDepartments} sub-department{blockers[d.id].childDepartments === 1 ? "" : "s"} — remove those
                      first.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
