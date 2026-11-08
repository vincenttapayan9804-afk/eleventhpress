"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, SESSION_ENDED_EVENT } from "@/lib/api-client";
import { getCsrfToken } from "@/lib/csrf-client";
import { CSRF_HEADER_NAME } from "@/lib/csrf";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Palette,
  Loader2,
  Save,
  RotateCcw,
  Upload,
  ImageIcon,
  Trash2,
  Link2,
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Share2,
  Sparkles,
  Check,
  AlertTriangle,
  Eye,
} from "lucide-react";
import {
  BRAND_COLOR_PRESETS,
  contrastRatio,
  extractPalette,
  isHexColor,
  normalizeHex,
  readableOn,
} from "@/lib/brand-colors";

const SOCIAL_FIELDS = [
  { key: "facebook", label: "Facebook", placeholder: "facebook.com/your-institution" },
  { key: "x", label: "X (Twitter)", placeholder: "x.com/your-institution" },
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/school/your-institution" },
  { key: "instagram", label: "Instagram", placeholder: "instagram.com/your-institution" },
  { key: "youtube", label: "YouTube", placeholder: "youtube.com/@your-institution" },
  { key: "tiktok", label: "TikTok", placeholder: "tiktok.com/@your-institution" },
  { key: "researchgate", label: "ResearchGate", placeholder: "researchgate.net/institution/..." },
] as const;

type SocialKey = (typeof SOCIAL_FIELDS)[number]["key"];

interface BrandingForm {
  siteName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  officialEmail: string;
  supportEmail: string;
  phone: string;
  phoneAlt: string;
  websiteUrl: string;
  address: string;
  socialLinks: Record<SocialKey, string>;
}

const EMPTY_SOCIAL = Object.fromEntries(SOCIAL_FIELDS.map((f) => [f.key, ""])) as Record<SocialKey, string>;

const EMPTY: BrandingForm = {
  siteName: "",
  tagline: "",
  logoUrl: "",
  faviconUrl: "",
  primaryColor: "",
  accentColor: "",
  fontFamily: "",
  officialEmail: "",
  supportEmail: "",
  phone: "",
  phoneAlt: "",
  websiteUrl: "",
  address: "",
  socialLinks: EMPTY_SOCIAL,
};

const DEFAULT_PRIMARY = "#4b2e83";
const DEFAULT_ACCENT = "#e4dbf5";

/** Draws an image to a small canvas and returns its dominant usable colours. */
async function paletteFromImage(src: string | Blob): Promise<string[]> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const url = typeof src === "string" ? src : URL.createObjectURL(src);
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("load"));
      img.src = url;
    });
    const size = 96;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, size / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    if (typeof src !== "string") URL.revokeObjectURL(url);
    return extractPalette(data, 6);
  } catch {
    // Cross-origin image without CORS headers, or not decodable — no
    // suggestions, the presets and picker still work.
    return [];
  }
}

/**
 * Whitelabel branding console. Edits the tenant this dashboard belongs to
 * (a tenant admin's own institution, or the official site for the platform
 * SUPER_ADMIN), or — when `tenantId` is passed from the Tenants tab — that
 * specific tenant. Everything is optional: blank fields fall back to the
 * Eleventh Press defaults.
 */
export function BrandingTab({ tenantId, onSaved }: { tenantId?: string; onSaved?: () => void } = {}) {
  const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
  const [tenant, setTenant] = useState<{ id: string; name: string; isPlatform: boolean } | null>(null);
  const [form, setForm] = useState<BrandingForm>(EMPTY);
  const [saved, setSaved] = useState<BrandingForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoColors, setLogoColors] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function load() {
    try {
      const res = await apiFetch<{
        tenant: { id: string; name: string; isPlatform: boolean };
        branding: Record<string, any>;
      }>(`/api/admin/tenant-branding${query}`);
      setTenant(res.tenant);
      const b = res.branding;
      const next: BrandingForm = {
        siteName: b.siteName ?? "",
        tagline: b.tagline ?? "",
        logoUrl: b.logoUrl ?? "",
        faviconUrl: b.faviconUrl ?? "",
        primaryColor: b.primaryColor ?? "",
        accentColor: b.accentColor ?? "",
        fontFamily: b.fontFamily ?? "",
        officialEmail: b.officialEmail ?? "",
        supportEmail: b.supportEmail ?? "",
        phone: b.phone ?? "",
        phoneAlt: b.phoneAlt ?? "",
        websiteUrl: b.websiteUrl ?? "",
        address: b.address ?? "",
        socialLinks: { ...EMPTY_SOCIAL, ...(b.socialLinks ?? {}) },
      };
      setForm(next);
      setSaved(next);
      if (next.logoUrl) paletteFromImage(next.logoUrl).then(setLogoColors);
    } catch (e: any) {
      toast.error(e.message || "Failed to load branding settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Deferred a tick so the fetch (and its state updates) run outside the effect body.
    void Promise.resolve().then(load);
  }, [tenantId]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);

  function field<K extends keyof BrandingForm>(key: K, value: BrandingForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const { [key as string]: _drop, ...rest } = prev;
      return rest;
    });
  }

  async function save() {
    setSaving(true);
    setErrors({});
    try {
      const social = Object.fromEntries(Object.entries(form.socialLinks).filter(([, v]) => v.trim()));
      const payload = {
        ...Object.fromEntries(
          Object.entries(form)
            .filter(([k]) => k !== "socialLinks")
            .map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? null : v])
        ),
        socialLinks: Object.keys(social).length ? social : null,
      };
      await apiFetch(`/api/admin/tenant-branding${query}`, { method: "PUT", body: JSON.stringify(payload) });
      await load();
      onSaved?.();
      if (tenantId) {
        toast.success("Branding saved for this tenant");
      } else {
        toast.success("Branding saved", {
          description: "Reload to see it across the whole platform.",
          action: { label: "Reload now", onClick: () => window.location.reload() },
        });
      }
    } catch (e: any) {
      // parseBody reports the first problem as "field: message" (or
      // "socialLinks.x: message" for a social profile).
      const details: Record<string, string> = {};
      const m = typeof e?.message === "string" ? e.message.match(/^([A-Za-z]+)(?:\.([A-Za-z]+))?: (.+)$/) : null;
      if (m) details[m[1]] = m[2] ? `${m[2]}: ${m[3]}` : m[3];
      setErrors(details);
      toast.error(Object.keys(details).length ? "Please fix the highlighted fields" : e.message || "Failed to save branding");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const primary = normalizeHex(form.primaryColor) ?? (form.primaryColor ? null : DEFAULT_PRIMARY);
  const accent = normalizeHex(form.accentColor) ?? (form.accentColor ? null : DEFAULT_ACCENT);
  const displayName = form.siteName || tenant?.name || "Eleventh Press";
  const defaultLabel = tenant?.isPlatform ? "the default Eleventh Press look" : "the Eleventh Press defaults";

  return (
    <div className="space-y-5">
      <Card className="paper-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <p className="eyebrow">Branding{tenant ? ` — ${tenant.name}` : ""}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Your logo, colours and organization details appear across this platform: the site header and
            footer, browser tab, dashboard, emails, certificates and other generated documents. Every field is
            optional; anything left blank uses {defaultLabel}.
          </p>
        </CardHeader>
        <CardContent className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            {/* Identity */}
            <Section icon={Building2} title="Identity">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldBox id="siteName" label="Organization / platform name" error={errors.siteName}>
                  <Input
                    id="siteName"
                    placeholder={tenant?.name || "Eleventh Press International Publishing"}
                    value={form.siteName}
                    onChange={(e) => field("siteName", e.target.value)}
                  />
                </FieldBox>
                <FieldBox id="tagline" label="Tagline" error={errors.tagline}>
                  <Input
                    id="tagline"
                    placeholder="An Enterprise Research Ecosystem"
                    value={form.tagline}
                    onChange={(e) => field("tagline", e.target.value)}
                  />
                </FieldBox>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <AssetUploader
                  kind="logo"
                  label="Logo"
                  hint="PNG, JPG or WebP, up to 2 MB. A square or wide logo on a transparent background works best."
                  value={form.logoUrl}
                  query={query}
                  error={errors.logoUrl}
                  onChange={(url) => field("logoUrl", url)}
                  onFile={(file) => paletteFromImage(file).then(setLogoColors)}
                />
                <AssetUploader
                  kind="favicon"
                  label="Favicon (browser tab icon)"
                  hint="Square PNG, at least 64 × 64 px. If blank, your logo is used."
                  value={form.faviconUrl}
                  query={query}
                  error={errors.faviconUrl}
                  onChange={(url) => field("faviconUrl", url)}
                />
              </div>
            </Section>

            {/* Colours */}
            <Section icon={Sparkles} title="Colours">
              {logoColors.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs font-medium">Colours from your logo</p>
                  <p className="mb-2 text-[0.7rem] text-muted-foreground">Click to use as primary · Shift-click to use as accent</p>
                  <div className="flex flex-wrap gap-2">
                    {logoColors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        title={`${c} — click: primary, shift-click: accent`}
                        aria-label={`Use ${c}`}
                        onClick={(e) => field(e.shiftKey ? "accentColor" : "primaryColor", c)}
                        className="h-8 w-8 rounded-full border border-black/10 shadow-sm ring-offset-2 transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <ColorField
                  id="primaryColor"
                  label="Primary colour"
                  hint="Buttons, links, highlights and document headers."
                  value={form.primaryColor}
                  fallback={DEFAULT_PRIMARY}
                  error={errors.primaryColor}
                  onChange={(v) => field("primaryColor", v)}
                  textOn
                />
                <ColorField
                  id="accentColor"
                  label="Accent colour"
                  hint="Soft backgrounds, hover states and badges."
                  value={form.accentColor}
                  fallback={DEFAULT_ACCENT}
                  error={errors.accentColor}
                  onChange={(v) => field("accentColor", v)}
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-medium">Ready-made palettes</p>
                <div className="flex flex-wrap gap-2">
                  {BRAND_COLOR_PRESETS.map((p) => {
                    const active =
                      normalizeHex(form.primaryColor) === p.primary && normalizeHex(form.accentColor) === p.accent;
                    return (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, primaryColor: p.primary, accentColor: p.accent }))}
                        className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition hover:border-primary/50 ${
                          active ? "border-primary bg-primary/5" : "border-border"
                        }`}
                      >
                        <span className="flex">
                          <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: p.primary }} />
                          <span className="-ml-1.5 h-4 w-4 rounded-full border border-black/10" style={{ background: p.accent }} />
                        </span>
                        {p.name}
                        {active && <Check className="h-3 w-3 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <FieldBox id="fontFamily" label="Font" className="sm:max-w-xs">
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
              </FieldBox>
            </Section>

            {/* Contact */}
            <Section icon={Mail} title="Contact details">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldBox id="officialEmail" label="Official email" icon={Mail} error={errors.officialEmail}>
                  <Input
                    id="officialEmail"
                    type="email"
                    placeholder="office@university.edu"
                    value={form.officialEmail}
                    onChange={(e) => field("officialEmail", e.target.value)}
                  />
                </FieldBox>
                <FieldBox id="supportEmail" label="Support / editorial email" icon={Mail} error={errors.supportEmail}>
                  <Input
                    id="supportEmail"
                    type="email"
                    placeholder="journal@university.edu"
                    value={form.supportEmail}
                    onChange={(e) => field("supportEmail", e.target.value)}
                  />
                </FieldBox>
                <FieldBox id="phone" label="Telephone" icon={Phone} error={errors.phone}>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+63 2 8123 4567"
                    value={form.phone}
                    onChange={(e) => field("phone", e.target.value)}
                  />
                </FieldBox>
                <FieldBox id="phoneAlt" label="Mobile / alternate number" icon={Phone} error={errors.phoneAlt}>
                  <Input
                    id="phoneAlt"
                    type="tel"
                    placeholder="+63 917 123 4567"
                    value={form.phoneAlt}
                    onChange={(e) => field("phoneAlt", e.target.value)}
                  />
                </FieldBox>
                <FieldBox id="websiteUrl" label="Official website" icon={Globe} error={errors.websiteUrl}>
                  <Input
                    id="websiteUrl"
                    placeholder="www.university.edu"
                    value={form.websiteUrl}
                    onChange={(e) => field("websiteUrl", e.target.value)}
                  />
                </FieldBox>
                <FieldBox id="address" label="Address" icon={MapPin} error={errors.address} className="sm:col-span-2">
                  <Textarea
                    id="address"
                    rows={2}
                    placeholder="Street, city, province/state, postal code, country"
                    value={form.address}
                    onChange={(e) => field("address", e.target.value)}
                  />
                </FieldBox>
              </div>
            </Section>

            {/* Social */}
            <Section icon={Share2} title="Social media">
              <div className="grid gap-4 sm:grid-cols-2">
                {SOCIAL_FIELDS.map((s) => (
                  <FieldBox key={s.key} id={`social-${s.key}`} label={s.label} error={errors.socialLinks?.startsWith(`${s.key}:`) ? "Enter a valid web address" : undefined}>
                    <Input
                      id={`social-${s.key}`}
                      placeholder={s.placeholder}
                      value={form.socialLinks[s.key]}
                      onChange={(e) => field("socialLinks", { ...form.socialLinks, [s.key]: e.target.value })}
                    />
                  </FieldBox>
                ))}
              </div>
            </Section>

            <Separator />

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={save} disabled={saving || !dirty}>
                {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                Save branding
              </Button>
              <Button variant="outline" onClick={() => setForm(saved)} disabled={saving || !dirty}>
                Discard changes
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setForm(EMPTY);
                  setLogoColors([]);
                }}
                disabled={saving}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Clear all (reset to default)
              </Button>
              {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
            </div>
          </div>

          {/* Live preview */}
          <aside className="min-w-0 xl:sticky xl:top-20 xl:self-start">
            <BrandPreview
              name={displayName}
              tagline={form.tagline}
              logoUrl={form.logoUrl}
              primary={primary ?? DEFAULT_PRIMARY}
              accent={accent ?? DEFAULT_ACCENT}
              serif={form.fontFamily === "fraunces"}
              email={form.officialEmail || form.supportEmail}
              phone={form.phone}
              website={form.websiteUrl}
              address={form.address}
              socials={SOCIAL_FIELDS.filter((s) => form.socialLinks[s.key].trim()).map((s) => s.label)}
            />
          </aside>
        </CardContent>
      </Card>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Mail; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </h3>
      {children}
    </section>
  );
}

function FieldBox({
  id,
  label,
  icon: Icon,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  icon?: typeof Mail;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={id} className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        {label}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ColorField({
  id,
  label,
  hint,
  value,
  fallback,
  error,
  onChange,
  textOn,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  fallback: string;
  error?: string;
  onChange: (v: string) => void;
  textOn?: boolean;
}) {
  const hex = normalizeHex(value);
  const swatch = hex ?? (value ? value : fallback);
  const pickerValue = hex ?? fallback;
  const fg = hex ? readableOn(hex) : null;
  const ratio = hex && fg ? contrastRatio(hex, fg) : null;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <label
          className="relative h-10 w-12 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border shadow-sm transition hover:ring-2 hover:ring-ring/40"
          style={{ background: swatch }}
          title="Open colour picker"
        >
          <input
            type="color"
            aria-label={`${label} picker`}
            value={pickerValue}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <Input
          id={id}
          placeholder={`${fallback} (default)`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-sm"
        />
      </div>
      <p className="text-[0.7rem] text-muted-foreground">{hint}</p>
      {textOn && hex && ratio !== null && (
        <p className={`flex items-center gap-1 text-[0.7rem] ${ratio >= 4.5 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
          {ratio >= 4.5 ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          Button text will be {fg === "#ffffff" ? "white" : "dark"} · contrast {ratio.toFixed(1)}:1
          {ratio < 4.5 ? " — consider a deeper shade for readability" : ""}
        </p>
      )}
      {value && !hex && !error && (
        <p className="text-[0.7rem] text-muted-foreground">Custom CSS colour — the picker and preview use the default until it's a hex value.</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function AssetUploader({
  kind,
  label,
  hint,
  value,
  query,
  error,
  onChange,
  onFile,
}: {
  kind: "logo" | "favicon";
  label: string;
  hint: string;
  value: string;
  query: string;
  error?: string;
  onChange: (url: string) => void;
  onFile?: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showUrl, setShowUrl] = useState(false);

  async function upload(file: File) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Use a PNG, JPG or WebP image");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image is larger than 2 MB");
      return;
    }
    onFile?.(file);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", kind);
      const headers: Record<string, string> = {};
      const csrf = getCsrfToken();
      if (csrf) headers[CSRF_HEADER_NAME] = csrf;
      const res = await fetch(`/api/admin/tenant-branding/asset${query}`, {
        method: "POST",
        body,
        headers,
        credentials: "same-origin",
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT));
      if (!res.ok) throw new Error(json.error || `Upload failed (${res.status})`);
      onChange(json.url);
      toast.success(`${kind === "logo" ? "Logo" : "Favicon"} uploaded — save branding to publish it`);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) upload(file);
        }}
        className={`flex items-center gap-3 rounded-lg border border-dashed p-3 transition ${
          dragging ? "border-primary bg-primary/5" : "border-border"
        }`}
      >
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-[repeating-conic-gradient(#f1f0f4_0_25%,#fff_0_50%)] bg-[length:12px_12px]">
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : value ? (
            <img src={value} alt={`${label} preview`} className="max-h-full max-w-full object-contain" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
              <Upload className="mr-1.5 h-3.5 w-3.5" /> {value ? "Replace" : "Upload"}
            </Button>
            {value && (
              <Button type="button" size="sm" variant="ghost" disabled={uploading} onClick={() => onChange("")}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
              </Button>
            )}
          </div>
          <p className="text-[0.7rem] leading-snug text-muted-foreground">{hint} Or drag an image here.</p>
          <button
            type="button"
            className="flex items-center gap-1 text-[0.7rem] text-primary hover:underline"
            onClick={() => setShowUrl((v) => !v)}
          >
            <Link2 className="h-3 w-3" /> {showUrl ? "Hide link field" : "Use an image link instead"}
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = "";
          }}
        />
      </div>
      {showUrl && (
        <Input placeholder="https://…/logo.png" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function BrandPreview({
  name,
  tagline,
  logoUrl,
  primary,
  accent,
  serif,
  email,
  phone,
  website,
  address,
  socials,
}: {
  name: string;
  tagline: string;
  logoUrl: string;
  primary: string;
  accent: string;
  serif: boolean;
  email: string;
  phone: string;
  website: string;
  address: string;
  socials: string[];
}) {
  const fg = isHexColor(primary) ? readableOn(primary) : "#ffffff";
  const accentFg = isHexColor(accent) ? readableOn(accent) : "#16121f";
  const font = serif ? "var(--font-serif), Georgia, serif" : undefined;
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Eye className="h-3.5 w-3.5" /> Live preview
      </p>
      <div className="overflow-hidden rounded-xl border border-border bg-white text-[#16121f] shadow-sm">
        {/* header */}
        <div className="flex items-center gap-2 border-b border-black/5 px-3 py-2.5">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full text-[0.65rem] font-bold" style={{ background: primary, color: fg }}>
              {name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold" style={{ fontFamily: font }}>
              {name}
            </p>
            {tagline && <p className="truncate text-[0.6rem] text-black/50">{tagline}</p>}
          </div>
        </div>
        {/* hero */}
        <div className="space-y-2 px-3 py-4" style={{ background: `linear-gradient(135deg, ${accent}66, transparent)` }}>
          <span className="inline-block rounded-full px-2 py-0.5 text-[0.6rem] font-medium" style={{ background: accent, color: accentFg }}>
            Open access
          </span>
          <p className="text-sm font-semibold leading-tight" style={{ fontFamily: font }}>
            Research that reaches further
          </p>
          <div className="flex gap-1.5">
            <span className="rounded-md px-2.5 py-1 text-[0.65rem] font-medium" style={{ background: primary, color: fg }}>
              Submit manuscript
            </span>
            <span className="rounded-md border px-2.5 py-1 text-[0.65rem] font-medium" style={{ borderColor: primary, color: primary }}>
              Browse
            </span>
          </div>
        </div>
        {/* document strip */}
        <div className="mx-3 mb-3 overflow-hidden rounded-md border border-black/10">
          <div className="h-5" style={{ background: primary }} />
          <div className="h-[2px] bg-[#c9a55c]" />
          <div className="space-y-1 p-2">
            <div className="h-1.5 w-3/4 rounded bg-black/15" />
            <div className="h-1.5 w-1/2 rounded bg-black/10" />
          </div>
          <p className="px-2 pb-1.5 text-[0.55rem] text-black/45">Certificates & PDFs</p>
        </div>
        {/* footer */}
        <div className="space-y-0.5 px-3 py-2.5 text-[0.6rem] leading-snug" style={{ background: primary, color: fg }}>
          <p className="font-semibold">{name}</p>
          {email && <p className="truncate opacity-90">{email}</p>}
          {phone && <p className="opacity-90">{phone}</p>}
          {website && <p className="truncate opacity-90">{website.replace(/^https?:\/\//, "")}</p>}
          {address && <p className="line-clamp-2 opacity-80">{address}</p>}
          {socials.length > 0 && <p className="opacity-80">{socials.join(" · ")}</p>}
          {!email && !phone && !website && !address && socials.length === 0 && (
            <p className="opacity-70">Contact details appear here</p>
          )}
        </div>
      </div>
    </div>
  );
}
