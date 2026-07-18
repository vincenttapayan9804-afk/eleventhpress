"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { PRIVILEGED_ROLES_LIST } from "@/lib/roles";
import { toast } from "sonner";
import {
  Loader2,
  Camera,
  Trash2,
  Briefcase,
  Globe2,
  Link2,
  Linkedin,
  Github,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Download,
  AlertOctagon,
} from "lucide-react";

interface Profile {
  id: string;
  fullName: string;
  email: string;
  bio: string | null;
  avatarUrl: string | null;
  profession: string | null;
  website: string | null;
  twitterUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  twoFactorEnabled: boolean;
}

const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ProfileTab() {
  const { user, setAuth, logout, setView } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Two-factor authentication (TOTP)
  const [twoFactorSetup, setTwoFactorSetup] = useState<{ secret: string; qrCode: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);

  // GDPR/CCPA data rights: export + account deletion
  const [exporting, setExporting] = useState(false);
  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    profession: "",
    bio: "",
    website: "",
    twitterUrl: "",
    linkedinUrl: "",
    githubUrl: "",
    contactEmail: "",
    contactPhone: "",
  });

  useEffect(() => {
    apiFetch<{ user: Profile }>("/api/auth/me")
      .then(({ user: p }) => {
        setProfile(p);
        setForm({
          fullName: p.fullName || "",
          profession: p.profession || "",
          bio: p.bio || "",
          website: p.website || "",
          twitterUrl: p.twitterUrl || "",
          linkedinUrl: p.linkedinUrl || "",
          githubUrl: p.githubUrl || "",
          contactEmail: p.contactEmail || "",
          contactPhone: p.contactPhone || "",
        });
      })
      .catch((e) => toast.error("Failed to load profile", { description: e.message }))
      .finally(() => setLoading(false));
  }, []);

  async function handleAvatarSelected(file: File) {
    if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
      toast.error("Unsupported image type", { description: "Allowed: JPEG, PNG, WebP, GIF" });
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("Image too large", { description: "Maximum 5 MB." });
      return;
    }

    // Instant local preview — the whole point of "seamless": the picture
    // changes the moment you pick it, before the network round-trip finishes.
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
    setAvatarUploading(true);

    try {
      // Always proxied through our own server rather than Vercel Blob's
      // direct-to-browser client-token protocol: that protocol requires a
      // classic BLOB_READ_WRITE_TOKEN to sign client tokens, which an
      // OIDC-only Blob connection doesn't have (a real gap — it's why
      // avatar uploads were failing with "Failed to retrieve the client
      // token"). Avatars are small (5 MB cap), so routing the bytes
      // through this app's own API — which already resolves to real Blob
      // storage via putObject()/presignGet() when connected — is both
      // simpler and doesn't depend on that extra credential existing.
      const presign = await apiFetch<{ uploadUrl: string; key: string; headers: Record<string, string> }>(
        "/api/storage/presign-local",
        {
          method: "POST",
          body: JSON.stringify({ filename: file.name, contentType: file.type, bucket: "avatars" }),
        }
      );
      const uploadRes = await fetch(presign.uploadUrl, { method: "PUT", body: file, headers: presign.headers });
      if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status})`);
      const { url: avatarUrl } = (await uploadRes.json()) as { url: string };

      const { user: updated } = await apiFetch<{ user: Profile }>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ avatarUrl }),
      });
      setProfile(updated);
      if (user) setAuth({ ...user, avatarUrl: updated.avatarUrl });
      toast.success("Profile picture updated");
    } catch (e: any) {
      toast.error("Upload failed", { description: e.message });
      setAvatarPreview(null);
    } finally {
      setAvatarUploading(false);
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function removeAvatar() {
    try {
      const { user: updated } = await apiFetch<{ user: Profile }>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ avatarUrl: null }),
      });
      setProfile(updated);
      setAvatarPreview(null);
      if (user) setAuth({ ...user, avatarUrl: null });
      toast.success("Profile picture removed");
    } catch (e: any) {
      toast.error("Failed to remove photo", { description: e.message });
    }
  }

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) {
      toast.error("Full name cannot be empty");
      return;
    }
    setSaving(true);
    try {
      const { user: updated } = await apiFetch<{ user: Profile }>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      setProfile(updated);
      setForm({
        fullName: updated.fullName || "",
        profession: updated.profession || "",
        bio: updated.bio || "",
        website: updated.website || "",
        twitterUrl: updated.twitterUrl || "",
        linkedinUrl: updated.linkedinUrl || "",
        githubUrl: updated.githubUrl || "",
        contactEmail: updated.contactEmail || "",
        contactPhone: updated.contactPhone || "",
      });
      if (user) setAuth({ ...user, fullName: updated.fullName });
      toast.success("Profile updated");
    } catch (e: any) {
      toast.error("Failed to save", { description: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function startTwoFactorSetup() {
    setTwoFactorBusy(true);
    try {
      const res = await apiFetch<{ secret: string; qrCode: string }>("/api/auth/2fa/setup", { method: "POST" });
      setTwoFactorSetup(res);
      setVerifyCode("");
    } catch (e: any) {
      toast.error("Couldn't start setup", { description: e.message });
    } finally {
      setTwoFactorBusy(false);
    }
  }

  async function confirmTwoFactorSetup() {
    if (verifyCode.length !== 6) return;
    setTwoFactorBusy(true);
    try {
      const res = await apiFetch<{ backupCodes: string[] }>("/api/auth/2fa/confirm", {
        method: "POST",
        body: JSON.stringify({ token: verifyCode }),
      });
      setBackupCodes(res.backupCodes);
      setTwoFactorSetup(null);
      setVerifyCode("");
      setProfile((p) => (p ? { ...p, twoFactorEnabled: true } : p));
      toast.success("Two-factor authentication enabled");
    } catch (e: any) {
      toast.error("Invalid code", { description: e.message });
    } finally {
      setTwoFactorBusy(false);
    }
  }

  async function disableTwoFactor(e: React.FormEvent) {
    e.preventDefault();
    setTwoFactorBusy(true);
    try {
      await apiFetch("/api/auth/2fa/disable", {
        method: "POST",
        body: JSON.stringify({ password: disablePassword }),
      });
      setProfile((p) => (p ? { ...p, twoFactorEnabled: false } : p));
      setShowDisableForm(false);
      setDisablePassword("");
      toast.success("Two-factor authentication disabled");
    } catch (e: any) {
      toast.error("Couldn't disable", { description: e.message });
    } finally {
      setTwoFactorBusy(false);
    }
  }

  async function exportMyData() {
    setExporting(true);
    try {
      const data = await apiFetch<Record<string, unknown>>("/api/account/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `eleventhpress-account-export-${profile?.id ?? "data"}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Your data export has downloaded");
    } catch (e: any) {
      toast.error("Export failed", { description: e.message });
    } finally {
      setExporting(false);
    }
  }

  async function deleteMyAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleting(true);
    try {
      await apiFetch("/api/account/delete", {
        method: "POST",
        body: JSON.stringify({ password: deletePassword }),
      });
      toast.success("Your account has been deleted");
      logout();
      setView("home");
    } catch (e: any) {
      toast.error("Couldn't delete account", { description: e.message });
    } finally {
      setDeleting(false);
    }
  }

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const displayAvatar = avatarPreview || profile.avatarUrl || undefined;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Public profile</p>
        <h2 className="mt-1 font-display text-2xl font-semibold">Your profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This is how you appear across the platform — your submissions, reviews, and any listing
          that shows your name.
        </p>
      </div>

      {/* Avatar */}
      <Card className="paper-card">
        <CardHeader>
          <p className="eyebrow">Profile picture</p>
        </CardHeader>
        <CardContent className="flex items-center gap-5">
          <div className="relative">
            <Avatar className="h-20 w-20 border border-[oklch(0.76_0.11_294/0.3)]">
              {displayAvatar && <AvatarImage src={displayAvatar} alt={profile.fullName} className="object-cover" />}
              <AvatarFallback className="bg-[oklch(0.93_0.04_290)] text-lg font-medium text-[oklch(0.42_0.18_295)]">
                {initialsOf(profile.fullName)}
              </AvatarFallback>
            </Avatar>
            {avatarUploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAvatarSelected(file);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={avatarUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="mr-2 h-3.5 w-3.5" />
              {profile.avatarUrl || avatarPreview ? "Change photo" : "Upload photo"}
            </Button>
            {(profile.avatarUrl || avatarPreview) && (
              <Button type="button" variant="ghost" size="sm" disabled={avatarUploading} onClick={removeAvatar}>
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove
              </Button>
            )}
            <p className="text-[0.65rem] text-muted-foreground">JPEG, PNG, WebP, or GIF. Max 5 MB.</p>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={saveDetails} className="space-y-6">
        {/* Name */}
        <Card className="paper-card">
          <CardHeader>
            <p className="eyebrow">Identity</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Dr. Jane Doe"
                required
                className="h-10"
              />
              <p className="text-[0.65rem] text-muted-foreground">
                Shown across the platform — submissions, reviews, and any listing with your name.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Profession & bio */}
        <Card className="paper-card">
          <CardHeader>
            <p className="eyebrow">Professional details</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="profession" className="flex items-center gap-1.5">
                <Briefcase className="h-3 w-3" /> Profession / title
              </Label>
              <Input
                id="profession"
                value={form.profession}
                onChange={(e) => setForm({ ...form, profession: e.target.value })}
                placeholder="e.g. Associate Professor of Computational Biology"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio">Biography</Label>
              <Textarea
                id="bio"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="A short professional biography — research interests, background, notable work…"
                className="min-h-32"
              />
            </div>
          </CardContent>
        </Card>

        {/* Social links */}
        <Card className="paper-card">
          <CardHeader>
            <p className="eyebrow">Social links</p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="website" className="flex items-center gap-1.5">
                <Globe2 className="h-3 w-3" /> Website
              </Label>
              <Input
                id="website"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="yourlab.university.edu"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="twitterUrl" className="flex items-center gap-1.5">
                <Link2 className="h-3 w-3" /> X / Twitter
              </Label>
              <Input
                id="twitterUrl"
                value={form.twitterUrl}
                onChange={(e) => setForm({ ...form, twitterUrl: e.target.value })}
                placeholder="x.com/yourhandle"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="linkedinUrl" className="flex items-center gap-1.5">
                <Linkedin className="h-3 w-3" /> LinkedIn
              </Label>
              <Input
                id="linkedinUrl"
                value={form.linkedinUrl}
                onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
                placeholder="linkedin.com/in/yourname"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="githubUrl" className="flex items-center gap-1.5">
                <Github className="h-3 w-3" /> GitHub
              </Label>
              <Input
                id="githubUrl"
                value={form.githubUrl}
                onChange={(e) => setForm({ ...form, githubUrl: e.target.value })}
                placeholder="github.com/yourhandle"
                className="h-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact info */}
        <Card className="paper-card">
          <CardHeader>
            <p className="eyebrow">Contact information</p>
            <p className="text-xs text-muted-foreground">
              Optional, and separate from your login email — only fill these in if you're comfortable
              making them visible to other users.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contactEmail" className="flex items-center gap-1.5">
                <Mail className="h-3 w-3" /> Public contact email
              </Label>
              <Input
                id="contactEmail"
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                placeholder="you@example.com"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactPhone" className="flex items-center gap-1.5">
                <Phone className="h-3 w-3" /> Phone
              </Label>
              <Input
                id="contactPhone"
                value={form.contactPhone}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                placeholder="+1 555 123 4567"
                className="h-10"
              />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save changes
        </Button>
      </form>

      {/* Two-factor authentication */}
      <Card className="paper-card">
        <CardHeader>
          <p className="eyebrow">Security</p>
          <h3 className="font-display text-lg font-semibold">Two-factor authentication</h3>
          <p className="text-xs text-muted-foreground">
            Adds a second step to sign-in — a 6-digit code from an authenticator app (Google
            Authenticator, Authy, 1Password) — in addition to your password.
            {user && PRIVILEGED_ROLES_LIST.includes(user.role) && !profile.twoFactorEnabled && (
              <span className="ml-1 font-medium text-amber-700">Recommended for your role.</span>
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {backupCodes ? (
            <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
                <KeyRound className="h-4 w-4" /> Save your backup codes
              </p>
              <p className="text-xs text-amber-800">
                Each code can be used once to sign in if you lose access to your authenticator app.
                They won't be shown again.
              </p>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-xs sm:grid-cols-5">
                {backupCodes.map((code) => (
                  <span key={code} className="rounded border border-amber-300 bg-white px-2 py-1 text-center">
                    {code}
                  </span>
                ))}
              </div>
              <Button type="button" size="sm" onClick={() => setBackupCodes(null)}>
                I've saved these codes
              </Button>
            </div>
          ) : twoFactorSetup ? (
            <div className="space-y-3">
              <p className="text-sm">Scan this QR code with your authenticator app, then enter the 6-digit code it shows.</p>
              <img src={twoFactorSetup.qrCode} alt="Two-factor authentication QR code" className="h-40 w-40 rounded-md border border-border" />
              <p className="text-[0.65rem] text-muted-foreground">
                Can't scan? Enter this key manually:{" "}
                <span className="font-mono">{twoFactorSetup.secret}</span>
              </p>
              <div className="space-y-1.5">
                <Label>Verification code</Label>
                <InputOTP maxLength={6} value={verifyCode} onChange={setVerifyCode}>
                  <InputOTPGroup>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" disabled={twoFactorBusy || verifyCode.length !== 6} onClick={confirmTwoFactorSetup}>
                  {twoFactorBusy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Confirm and enable
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setTwoFactorSetup(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : profile.twoFactorEnabled ? (
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <ShieldCheck className="h-4 w-4" /> Two-factor authentication is enabled
              </p>
              {showDisableForm ? (
                <form onSubmit={disableTwoFactor} className="space-y-2">
                  <Label htmlFor="disable2fa-pass">Confirm your password to disable</Label>
                  <Input
                    id="disable2fa-pass"
                    type="password"
                    required
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    className="h-10 max-w-xs"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" variant="destructive" disabled={twoFactorBusy}>
                      {twoFactorBusy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                      Disable
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setShowDisableForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <Button type="button" size="sm" variant="outline" onClick={() => setShowDisableForm(true)}>
                  Disable two-factor authentication
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <ShieldAlert className="h-4 w-4" /> Not enabled
              </p>
              <Button type="button" size="sm" disabled={twoFactorBusy} onClick={startTwoFactorSetup}>
                {twoFactorBusy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Enable two-factor authentication
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* GDPR/CCPA data rights — see /privacy for the full policy this implements */}
      <Card className="paper-card">
        <CardHeader>
          <p className="eyebrow">Your data</p>
          <h3 className="font-display text-lg font-semibold">Export or delete your account</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4">
            <div>
              <p className="text-sm font-medium">Export my data</p>
              <p className="text-xs text-muted-foreground">
                Download a JSON copy of your profile, submissions, reviews, invoices, and notifications.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" disabled={exporting} onClick={exportMyData}>
              {exporting ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="mr-2 h-3.5 w-3.5" />
              )}
              Download export
            </Button>
          </div>

          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
            <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
              <AlertOctagon className="h-4 w-4" /> Delete my account
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Immediately and permanently anonymizes your profile (name, email, bio, and every
              other personal field) and signs you out everywhere. The citable author byline on any
              already-published, DOI-bearing article is a permanent part of that DOI's record and
              is not retroactively changed. This cannot be undone.
            </p>
            {showDeleteForm ? (
              <form onSubmit={deleteMyAccount} className="mt-3 space-y-2">
                <Label htmlFor="delete-account-pass">Confirm your password</Label>
                <Input
                  id="delete-account-pass"
                  type="password"
                  required
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="h-10 max-w-xs"
                />
                <Label htmlFor="delete-account-confirm">
                  Type <span className="font-mono font-semibold">DELETE</span> to confirm
                </Label>
                <Input
                  id="delete-account-confirm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="h-10 max-w-xs"
                />
                <div className="flex gap-2 pt-1">
                  <Button
                    type="submit"
                    size="sm"
                    variant="destructive"
                    disabled={deleting || deleteConfirmText !== "DELETE" || !deletePassword}
                  >
                    {deleting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    Permanently delete my account
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowDeleteForm(false);
                      setDeletePassword("");
                      setDeleteConfirmText("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3 text-destructive hover:text-destructive"
                onClick={() => setShowDeleteForm(true)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete my account
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
