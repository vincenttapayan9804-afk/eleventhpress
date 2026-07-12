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
  const { user, token, setAuth } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
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
      if (token && user) setAuth(token, { ...user, avatarUrl: updated.avatarUrl });
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
      if (token && user) setAuth(token, { ...user, avatarUrl: null });
      toast.success("Profile picture removed");
    } catch (e: any) {
      toast.error("Failed to remove photo", { description: e.message });
    }
  }

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { user: updated } = await apiFetch<{ user: Profile }>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      setProfile(updated);
      setForm({
        profession: updated.profession || "",
        bio: updated.bio || "",
        website: updated.website || "",
        twitterUrl: updated.twitterUrl || "",
        linkedinUrl: updated.linkedinUrl || "",
        githubUrl: updated.githubUrl || "",
        contactEmail: updated.contactEmail || "",
        contactPhone: updated.contactPhone || "",
      });
      toast.success("Profile updated");
    } catch (e: any) {
      toast.error("Failed to save", { description: e.message });
    } finally {
      setSaving(false);
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
    </div>
  );
}
