"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Palette, Loader2, Save, RotateCcw } from "lucide-react";

interface Branding {
  siteName: string | null;
  tagline: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  fontFamily: string | null;
}

const EMPTY: Branding = {
  siteName: "",
  tagline: "",
  logoUrl: "",
  faviconUrl: "",
  primaryColor: "",
  accentColor: "",
  fontFamily: "",
};

/**
 * SUPER_ADMIN-only whitelabel branding console (Phase 2). Edits the tenant
 * resolved from the current request's Host header via
 * /api/admin/tenant-branding — for today's single-tenant deployment that's
 * always the platform tenant, but the same panel works unmodified once a
 * tenant is reached on its own domain (Phase 3).
 */
export function BrandingTab() {
  const [tenantLabel, setTenantLabel] = useState<string | null>(null);
  const [form, setForm] = useState<Branding>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch<{ tenant: { name: string }; branding: Branding }>("/api/admin/tenant-branding");
      setTenantLabel(res.tenant.name);
      setForm({
        siteName: res.branding.siteName ?? "",
        tagline: res.branding.tagline ?? "",
        logoUrl: res.branding.logoUrl ?? "",
        faviconUrl: res.branding.faviconUrl ?? "",
        primaryColor: res.branding.primaryColor ?? "",
        accentColor: res.branding.accentColor ?? "",
        fontFamily: res.branding.fontFamily ?? "",
      });
    } catch (e: any) {
      toast.error(e.message || "Failed to load branding settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function field(key: keyof Branding, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v === "" ? null : v])
      );
      await apiFetch("/api/admin/tenant-branding", { method: "PUT", body: JSON.stringify(payload) });
      toast.success("Branding saved — refresh to see it applied site-wide.");
    } catch (e: any) {
      toast.error(e.message || "Failed to save branding");
    } finally {
      setSaving(false);
    }
  }

  function resetToDefault() {
    setForm(EMPTY);
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
            <Palette className="h-4 w-4 text-primary" />
            <p className="eyebrow">Branding{tenantLabel ? ` — ${tenantLabel}` : ""}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Every field is optional. Leave blank to keep the default Eleventh Press look — nothing
            here is required for the site to work correctly.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="siteName">Site name</Label>
              <Input
                id="siteName"
                placeholder="Eleventh Press International Publishing"
                value={form.siteName ?? ""}
                onChange={(e) => field("siteName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                placeholder="A Full-Stack Peer Reviewed Press"
                value={form.tagline ?? ""}
                onChange={(e) => field("tagline", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                placeholder="https://…/logo.png"
                value={form.logoUrl ?? ""}
                onChange={(e) => field("logoUrl", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="faviconUrl">Favicon URL</Label>
              <Input
                id="faviconUrl"
                placeholder="https://…/favicon.png"
                value={form.faviconUrl ?? ""}
                onChange={(e) => field("faviconUrl", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="primaryColor">Primary color</Label>
              <Input
                id="primaryColor"
                placeholder="oklch(0.38 0.18 295) or #4b2e83"
                value={form.primaryColor ?? ""}
                onChange={(e) => field("primaryColor", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="accentColor">Accent color</Label>
              <Input
                id="accentColor"
                placeholder="oklch(0.90 0.05 290) or #d6c8f2"
                value={form.accentColor ?? ""}
                onChange={(e) => field("accentColor", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fontFamily">Font family</Label>
              <Select value={form.fontFamily || "__default"} onValueChange={(v) => field("fontFamily", v === "__default" ? "" : v)}>
                <SelectTrigger id="fontFamily">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default">Default (Inter)</SelectItem>
                  <SelectItem value="inter">Inter</SelectItem>
                  <SelectItem value="fraunces">Fraunces (serif)</SelectItem>
                  <SelectItem value="system">System default</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Save branding
            </Button>
            <Button variant="outline" onClick={resetToDefault} disabled={saving}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Clear all (reset to default)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
