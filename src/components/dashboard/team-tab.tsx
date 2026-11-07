"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useApp } from "@/lib/store";
import { useTenantBranding } from "@/lib/tenant-branding-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Users2, UserPlus, Loader2, Copy, Check, Search, MailCheck, MailWarning } from "lucide-react";

const ROLE_OPTIONS = [
  { value: "EDITOR", label: "Editor", hint: "Runs the editorial workflow" },
  { value: "ASSOCIATE_EDITOR", label: "Associate editor", hint: "Handles assigned manuscripts" },
  { value: "REVIEWER", label: "Reviewer", hint: "Reviews manuscripts" },
  { value: "AUTHOR", label: "Author", hint: "Submits manuscripts" },
  { value: "READER", label: "Reader", hint: "Reads and follows research" },
] as const;

const ROLE_LABEL: Record<string, string> = {
  TENANT_ADMIN: "Administrator",
  EDITOR: "Editor",
  ASSOCIATE_EDITOR: "Associate editor",
  REVIEWER: "Reviewer",
  AUTHOR: "Author",
  READER: "Reader",
  EXPERT: "Expert",
  SUPER_ADMIN: "Platform admin",
};

interface Member {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
}

/**
 * Tenant admin's "Team & access": everyone on the institution's platform,
 * their roles, and adding new editors/reviewers/authors with emailed
 * sign-in details.
 */
export function TeamTab() {
  const me = useApp((s) => s.user);
  const branding = useTenantBranding();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ fullName: "", email: "", role: "EDITOR" });
  const [adding, setAdding] = useState(false);
  const [created, setCreated] = useState<{ email: string; temporaryPassword: string; loginUrl: string; emailDelivered: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);

  async function load() {
    try {
      const res = await apiFetch<{ users: Member[] }>("/api/admin/users");
      setMembers(res.users);
    } catch (e: any) {
      toast.error(e.message || "Failed to load your team");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Deferred a tick so the fetch (and its state updates) run outside the effect body.
    void Promise.resolve().then(load);
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await apiFetch<{ user: Member; temporaryPassword: string; loginUrl: string; emailDelivered: boolean }>(
        "/api/admin/tenant-members",
        { method: "POST", body: JSON.stringify(form) }
      );
      setCreated({ email: res.user.email, temporaryPassword: res.temporaryPassword, loginUrl: res.loginUrl, emailDelivered: res.emailDelivered });
      setCopied(false);
      setForm({ fullName: "", email: "", role: form.role });
      toast.success(`${res.user.fullName} added`);
      load();
    } catch (err: any) {
      toast.error(String(err.message || "Couldn't add this person").replace(/^\w+: /, ""));
    } finally {
      setAdding(false);
    }
  }

  async function changeRole(m: Member, role: string) {
    setChangingId(m.id);
    try {
      await apiFetch(`/api/admin/users/${m.id}/role`, { method: "POST", body: JSON.stringify({ role }) });
      setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, role } : x)));
      toast.success(`${m.fullName} is now ${ROLE_LABEL[role]?.toLowerCase() ?? role}`);
    } catch (err: any) {
      toast.error(err.message || "Couldn't change the role");
    } finally {
      setChangingId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? members.filter((m) => m.fullName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)) : members;
  }, [members, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of members) c[m.role] = (c[m.role] ?? 0) + 1;
    return c;
  }, [members]);

  const credentialText = created
    ? `Sign in at: ${created.loginUrl}\nEmail: ${created.email}\nTemporary password: ${created.temporaryPassword}`
    : "";

  return (
    <div className="space-y-5">
      <Card className="paper-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <p className="eyebrow">Add a team member</p>
          </div>
          <p className="text-xs text-muted-foreground">
            They get an email from {branding.siteName || branding.tenantName || "your institution"} with a temporary password,
            and choose their own when they first sign in.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_1fr_200px_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="tm-name">Full name</Label>
              <Input id="tm-name" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Dr. Maria Santos" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tm-email">Email</Label>
              <Input id="tm-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="maria.santos@university.edu" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tm-role">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger id="tm-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={adding || !form.fullName.trim() || !form.email.trim()}>
              {adding ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <UserPlus className="mr-1.5 h-3.5 w-3.5" />}
              Add
            </Button>
          </form>

          {created && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
              <p className="flex items-center gap-1.5 font-medium">
                {created.emailDelivered ? (
                  <>
                    <MailCheck className="h-4 w-4 text-emerald-600" /> Sign-in details emailed to {created.email}
                  </>
                ) : (
                  <>
                    <MailWarning className="h-4 w-4 text-amber-600" /> Email isn't set up yet — share these details with {created.email} yourself
                  </>
                )}
              </p>
              <pre className="mt-2 whitespace-pre-wrap rounded-md bg-background p-3 font-mono text-xs">{credentialText}</pre>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard?.writeText(credentialText).then(() => setCopied(true));
                  }}
                >
                  {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy details"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCreated(null)}>
                  Done
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">This password is shown only once.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="paper-card">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users2 className="h-4 w-4 text-primary" />
              <p className="eyebrow">Your team ({members.length})</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email" className="pl-8" />
            </div>
          </div>
          {members.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {Object.entries(counts).map(([role, n]) => (
                <Badge key={role} variant="outline" className="text-[0.65rem]">
                  {ROLE_LABEL[role] ?? role}: {n}
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{members.length ? "No one matches that search." : "No team members yet."}</p>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((m) => {
                const locked = m.role === "TENANT_ADMIN" || m.role === "SUPER_ADMIN" || m.id === me?.id;
                return (
                  <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                    </div>
                    {locked ? (
                      <Badge variant="secondary">{ROLE_LABEL[m.role] ?? m.role}</Badge>
                    ) : (
                      <Select value={m.role} onValueChange={(v) => changeRole(m, v)} disabled={changingId === m.id}>
                        <SelectTrigger className="h-8 w-44 text-xs" aria-label={`Role for ${m.fullName}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                          {!ROLE_OPTIONS.some((r) => r.value === m.role) && <SelectItem value={m.role}>{ROLE_LABEL[m.role] ?? m.role}</SelectItem>}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
