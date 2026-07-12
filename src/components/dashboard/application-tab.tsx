"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  FileCheck2,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  FileText,
  GraduationCap,
  Award,
  Briefcase,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";

interface Application {
  id: string;
  requestedRole: string;
  status: string;
  applicationText: string | null;
  orcidId: string | null;
  expertise: string | null;
  specializations: string | null;
  resumeKey: string | null;
  transcriptKey: string | null;
  certificateKeys: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: "Pending Review", color: "bg-amber-100 text-amber-800 border-amber-300", icon: Clock },
  UNDER_REVIEW: { label: "Under Review", color: "bg-blue-100 text-blue-800 border-blue-300", icon: FileCheck2 },
  APPROVED: { label: "Approved", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: CheckCircle2 },
  REJECTED: { label: "Not Approved", color: "bg-rose-100 text-rose-800 border-rose-300", icon: XCircle },
};

export function ApplicationTab({ onRefresh }: Props) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    applicationText: "",
    orcidId: "",
    expertise: "",
    specializations: "",
  });
  const [resumeKey, setResumeKey] = useState<string | null>(null);
  const [transcriptKey, setTranscriptKey] = useState<string | null>(null);
  const [certificateKeys, setCertificateKeys] = useState<string[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);

  const loadApplications = useCallback(async () => {
    try {
      const res = await apiFetch<{ applications: Application[] }>("/api/applications");
      setApplications(res.applications);
      const active = res.applications.find((a) => ["PENDING", "UNDER_REVIEW"].includes(a.status));
      if (active) {
        setForm({
          applicationText: active.applicationText || "",
          orcidId: active.orcidId || "",
          expertise: active.expertise || "",
          specializations: active.specializations || "",
        });
        setResumeKey(active.resumeKey);
        setTranscriptKey(active.transcriptKey);
        setCertificateKeys(active.certificateKeys ? JSON.parse(active.certificateKeys) : []);
      }
    } catch (e: any) {
      toast.error("Failed to load application", { description: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  async function uploadFile(file: File, purpose: string): Promise<string | null> {
    setUploading(purpose);
    try {
      const presign = await apiFetch<{ uploadUrl: string; key: string; headers: Record<string, string> }>(
        "/api/storage/presign-local",
        {
          method: "POST",
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            bucket: "applications",
          }),
        }
      );

      await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: presign.headers,
        body: file,
      });

      toast.success(`${purpose} uploaded`);
      return presign.key;
    } catch (e: any) {
      toast.error(`Upload failed`, { description: e.message });
      return null;
    } finally {
      setUploading(null);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, purpose: string) {
    const file = e.target.files?.[0];
    if (!file) return;

    const key = await uploadFile(file, purpose);
    if (!key) return;

    if (purpose === "Resume") setResumeKey(key);
    else if (purpose === "Transcript") setTranscriptKey(key);
    else if (purpose === "Certificate") setCertificateKeys((prev) => [...prev, key]);
  }

  function removeCertificate(idx: number) {
    setCertificateKeys((prev) => prev.filter((_, i) => i !== idx));
  }

  async function saveApplication() {
    const activeApp = applications.find((a) => ["PENDING", "UNDER_REVIEW"].includes(a.status));
    if (!activeApp) return;

    setSaving(true);
    try {
      await apiFetch("/api/applications", {
        method: "POST",
        body: JSON.stringify({
          requestedRole: activeApp.requestedRole,
          ...form,
          resumeKey,
          transcriptKey,
          certificateKeys,
        }),
      });
      toast.success("Application updated");
      loadApplications();
    } catch (e: any) {
      toast.error("Save failed", { description: e.message });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const activeApp = applications.find((a) => ["PENDING", "UNDER_REVIEW"].includes(a.status));
  const approvedApp = applications.find((a) => a.status === "APPROVED");
  const rejectedApp = applications.find((a) => a.status === "REJECTED" && !activeApp);

  if (approvedApp) {
    return (
      <Card className="paper-card">
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h2 className="mt-4 font-display text-2xl font-semibold">Application Approved</h2>
          <p className="mt-2 text-muted-foreground">
            Your {approvedApp.requestedRole.toLowerCase()} application has been approved.
            Please sign out and sign back in to access your new dashboard features.
          </p>
          <Badge className="mt-4 bg-emerald-100 text-emerald-800 border-emerald-300">
            {approvedApp.requestedRole}
          </Badge>
        </CardContent>
      </Card>
    );
  }

  if (!activeApp && rejectedApp) {
    return (
      <Card className="paper-card">
        <CardContent className="py-12 text-center">
          <XCircle className="mx-auto h-12 w-12 text-rose-500" />
          <h2 className="mt-4 font-display text-2xl font-semibold">Application Not Approved</h2>
          {rejectedApp.reviewNote && (
            <p className="mt-2 text-sm text-muted-foreground">Reason: {rejectedApp.reviewNote}</p>
          )}
          <p className="mt-2 text-muted-foreground">
            You may submit a new application with updated qualifications.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!activeApp) {
    return (
      <Card className="paper-card">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No active role application found.</p>
        </CardContent>
      </Card>
    );
  }

  const statusCfg = STATUS_CONFIG[activeApp.status] || STATUS_CONFIG.PENDING;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="space-y-5">
      {/* Status banner */}
      <Card className="paper-card">
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <StatusIcon className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="font-display text-xl font-semibold">
                {activeApp.requestedRole === "REVIEWER" ? "Peer Reviewer" : "Editor"} Application
              </h2>
              <p className="text-sm text-muted-foreground">
                Submitted {new Date(activeApp.createdAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}
              </p>
            </div>
            <Badge className={statusCfg.color}>{statusCfg.label}</Badge>
          </div>

          {/* Progress steps */}
          <div className="mt-6 flex items-center gap-2">
            {["PENDING", "UNDER_REVIEW", "APPROVED"].map((step, i) => {
              const steps = ["PENDING", "UNDER_REVIEW", "APPROVED"];
              const currentIdx = steps.indexOf(activeApp.status);
              const done = i <= currentIdx;
              return (
                <div key={step} className="flex flex-1 items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                      done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i + 1}
                  </div>
                  {i < 2 && (
                    <div className={`h-0.5 flex-1 ${done && i < currentIdx ? "bg-primary" : "bg-muted"}`} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex text-[0.65rem] text-muted-foreground">
            <span className="flex-1 text-center">Submitted</span>
            <span className="flex-1 text-center">Under Review</span>
            <span className="flex-1 text-center">Decision</span>
          </div>
        </CardContent>
      </Card>

      {/* Application form */}
      <Card className="paper-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            <p className="eyebrow">Qualifications & Documents</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Upload your professional credentials. All documents are reviewed by the editorial board.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* ORCID */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              ORCID iD
            </Label>
            <Input
              value={form.orcidId}
              onChange={(e) => setForm({ ...form, orcidId: e.target.value })}
              placeholder="0000-0002-1825-0097"
              className="h-10"
            />
          </div>

          {/* Expertise */}
          <div className="space-y-1.5">
            <Label className="text-sm">Areas of Expertise</Label>
            <Input
              value={form.expertise}
              onChange={(e) => setForm({ ...form, expertise: e.target.value })}
              placeholder="e.g. Machine Learning, Natural Language Processing"
              className="h-10"
            />
          </div>

          {/* Specializations */}
          <div className="space-y-1.5">
            <Label className="text-sm">Specializations</Label>
            <Input
              value={form.specializations}
              onChange={(e) => setForm({ ...form, specializations: e.target.value })}
              placeholder="e.g. Deep Learning, Transformer Architectures"
              className="h-10"
            />
          </div>

          {/* Application narrative */}
          <div className="space-y-1.5">
            <Label className="text-sm">Application Statement</Label>
            <textarea
              value={form.applicationText}
              onChange={(e) => setForm({ ...form, applicationText: e.target.value })}
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Describe your qualifications, relevant experience, and motivation for becoming a reviewer/editor..."
            />
          </div>

          <Separator />

          {/* Document uploads */}
          <div className="space-y-4">
            {/* Resume */}
            <div className="rounded-md border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Professional Resume / CV</Label>
              </div>
              {resumeKey ? (
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <FileCheck2 className="h-4 w-4" />
                  <span>Uploaded</span>
                  <button onClick={() => setResumeKey(null)} className="ml-2 text-xs text-muted-foreground hover:text-rose-600">
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => handleFileChange(e, "Resume")}
                    disabled={uploading !== null}
                    className="text-sm"
                  />
                  {uploading === "Resume" && <Loader2 className="mt-1 h-4 w-4 animate-spin" />}
                </div>
              )}
            </div>

            {/* Transcript */}
            <div className="rounded-md border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Transcript of Records</Label>
              </div>
              <p className="text-xs text-muted-foreground mb-2">Scanned copy of your educational transcript (PDF or image)</p>
              {transcriptKey ? (
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <FileCheck2 className="h-4 w-4" />
                  <span>Uploaded</span>
                  <button onClick={() => setTranscriptKey(null)} className="ml-2 text-xs text-muted-foreground hover:text-rose-600">
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => handleFileChange(e, "Transcript")}
                    disabled={uploading !== null}
                    className="text-sm"
                  />
                  {uploading === "Transcript" && <Loader2 className="mt-1 h-4 w-4 animate-spin" />}
                </div>
              )}
            </div>

            {/* Certificates */}
            <div className="rounded-md border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Certificates & Credentials</Label>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Research certificates, peer reviewer certifications, grammarian/statistician credentials, PRC ID, etc.
              </p>
              {certificateKeys.length > 0 && (
                <div className="mb-2 space-y-1">
                  {certificateKeys.map((k, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-emerald-700">
                      <FileText className="h-3.5 w-3.5" />
                      <span>Certificate {i + 1}</span>
                      <button onClick={() => removeCertificate(i)} className="ml-2 text-xs text-muted-foreground hover:text-rose-600">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => handleFileChange(e, "Certificate")}
                  disabled={uploading !== null}
                  className="text-sm"
                />
                {uploading === "Certificate" && <Loader2 className="mt-1 h-4 w-4 animate-spin" />}
              </div>
            </div>
          </div>

          <Button onClick={saveApplication} disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Upload className="mr-1.5 h-4 w-4" /> Save Application
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
