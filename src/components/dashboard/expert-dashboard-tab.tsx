"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Crown,
  Sparkles,
  FileText,
  Eye,
  Users,
  Share2,
  Award,
  Download,
  Loader2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

interface ExpertSelf {
  key: string;
  name: string;
  expertTier: string | null;
  insightCount: number;
  totalViews: number;
  totalShares: number;
  followerCount: number;
}

interface SealCertificate {
  id: string;
  serialNumber: string;
  issuedAt: string;
}

const TIER_LABELS: Record<string, string> = {
  COUNCIL_MEMBER: "Council Member",
  CONTRIBUTOR: "Contributor",
};

/**
 * The Professional Dashboard — the Council-specific landing surface an
 * Expert sees, distinct from the generic role-agnostic Overview tab.
 * Surfaces the same real numbers shown publicly on the Council of Experts'
 * Directory (via /api/experts) rather than recomputing them separately,
 * plus the Seal of Quality's actual issuance state (via /api/certificates)
 * — never a fabricated "you're verified!" banner.
 */
export function ExpertDashboardTab() {
  const { user, openDashboard, setView } = useApp();
  const [self, setSelf] = useState<ExpertSelf | null>(null);
  const [seal, setSeal] = useState<SealCertificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      apiFetch<{ experts: ExpertSelf[] }>("/api/experts"),
      apiFetch<{ certificates: { id: string; type: string; category: string; serialNumber: string; issuedAt: string }[] }>("/api/certificates"),
    ])
      .then(([expertsRes, certsRes]) => {
        setSelf(expertsRes.experts.find((e) => e.key === user.id) ?? null);
        const sealCert = certsRes.certificates.find((c) => c.type === "MEMBERSHIP" && c.category === "EXPERT");
        setSeal(sealCert ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  async function issueSeal() {
    setIssuing(true);
    try {
      const res = await apiFetch<{ certificate: SealCertificate }>("/api/certificates", {
        method: "POST",
        body: JSON.stringify({ type: "MEMBERSHIP", category: "EXPERT" }),
      });
      setSeal(res.certificate);
      toast.success("Seal of Quality issued");
    } catch (e: any) {
      toast.error("Could not issue Seal of Quality", { description: e.message });
    } finally {
      setIssuing(false);
    }
  }

  async function downloadSeal() {
    if (!seal) return;
    try {
      const res = await apiFetch<{ url: string }>(`/api/certificates/${seal.id}/download`);
      window.open(res.url, "_blank");
    } catch (e: any) {
      toast.error("Download failed", { description: e.message });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const tier = user?.expertTier ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="paper-card overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow flex items-center gap-1.5">
                {tier === "COUNCIL_MEMBER" && <Crown className="h-3.5 w-3.5" />}
                Council of Experts {tier ? `· ${TIER_LABELS[tier] || tier}` : ""}
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold">
                Welcome, {user?.fullName.split(" ")[0]}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Publish board-reviewed Expert Insights and track your standing in the Council.
              </p>
            </div>
            <Button onClick={() => openDashboard("submit")}>
              <Sparkles className="mr-1.5 h-4 w-4" /> Submit an Insight
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Real stats — the same numbers shown publicly in the Directory */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FileText} label="Published insights" value={self?.insightCount ?? 0} />
        <StatCard icon={Eye} label="Total views" value={self?.totalViews ?? 0} />
        <StatCard icon={Share2} label="Total shares" value={self?.totalShares ?? 0} />
        <StatCard icon={Users} label="Followers" value={self?.followerCount ?? 0} />
      </div>

      {/* Seal of Quality */}
      <Card className="paper-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            <p className="eyebrow">Seal of Quality</p>
          </div>
        </CardHeader>
        <CardContent>
          {seal ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-300 bg-emerald-50 p-4">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-800">
                  <ShieldCheck className="h-4 w-4" /> Issued
                </p>
                <p className="mt-0.5 font-mono text-xs text-emerald-700">{seal.serialNumber}</p>
                <p className="text-[0.65rem] text-emerald-700">
                  {new Date(seal.issuedAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={downloadSeal}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> Download PDF
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4">
              <p className="text-sm text-muted-foreground">
                Not yet issued — every vetted Council member is entitled to one real, serial-numbered credential.
              </p>
              <Button size="sm" onClick={issueSeal} disabled={issuing}>
                {issuing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Award className="mr-1.5 h-3.5 w-3.5" />}
                Issue my Seal
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ask an Expert inbox */}
      {user && <ExpertQuestionsInbox expertId={user.id} />}

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-3">
        <QuickLink icon={FileText} label="My insights" onClick={() => openDashboard("myArticles")} />
        <QuickLink icon={Users} label="Council of Experts' Directory" onClick={() => setView("experts")} />
        <QuickLink icon={ShieldCheck} label="Publication Charter" onClick={() => setView("charter")} />
      </div>
    </div>
  );
}

interface InboxQuestion {
  id: string;
  question: string;
  answer: string | null;
  answeredAt: string | null;
  isPublic: boolean;
  createdAt: string;
  askerName: string;
}

/**
 * "Ask an Expert" inbox — every question this expert has received,
 * pending or answered (src/app/api/experts/[id]/questions/inbox).
 * Answering here is what actually makes a question eligible to appear on
 * the public Council of Experts' Directory profile — nothing here is
 * public until the expert explicitly answers with "Publish publicly".
 */
function ExpertQuestionsInbox({ expertId }: { expertId: string }) {
  const [questions, setQuestions] = useState<InboxQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [answering, setAnswering] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [makePublic, setMakePublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    setLoading(true);
    apiFetch<{ items: InboxQuestion[] }>(`/api/experts/${expertId}/questions/inbox`)
      .then(({ items }) => setQuestions(items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [expertId]);

  async function submitAnswer(questionId: string) {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/experts/${expertId}/questions/${questionId}`, {
        method: "POST",
        body: JSON.stringify({ answer: trimmed, isPublic: makePublic }),
      });
      toast.success("Answer submitted");
      setAnswering(null);
      setDraft("");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const pending = questions.filter((q) => !q.answeredAt);
  const answered = questions.filter((q) => q.answeredAt);

  if (loading) return null;
  if (questions.length === 0) return null;

  return (
    <Card className="paper-card">
      <CardHeader>
        <p className="eyebrow">Ask an Expert</p>
        <p className="text-sm text-muted-foreground">
          {pending.length} pending question{pending.length === 1 ? "" : "s"}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {pending.map((q) => (
          <div key={q.id} className="rounded-md border border-border p-4">
            <p className="text-xs text-muted-foreground">From {q.askerName}</p>
            <p className="mt-1 text-sm font-medium leading-snug">{q.question}</p>
            {answering === q.id ? (
              <div className="mt-3 space-y-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Your answer…"
                  rows={4}
                  className="w-full rounded-md border border-input bg-background p-2 text-sm"
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={makePublic} onChange={(e) => setMakePublic(e.target.checked)} />
                  Publish publicly on my profile
                </label>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setAnswering(null); setDraft(""); }}>
                    Cancel
                  </Button>
                  <Button size="sm" disabled={submitting || !draft.trim()} onClick={() => submitAnswer(q.id)}>
                    {submitting && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />} Submit answer
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => { setAnswering(q.id); setDraft(""); setMakePublic(true); }}
              >
                Answer
              </Button>
            )}
          </div>
        ))}
        {answered.length > 0 && (
          <p className="pt-2 text-xs text-muted-foreground">{answered.length} question{answered.length === 1 ? "" : "s"} answered</p>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card className="paper-card">
      <CardContent className="p-5">
        <Icon className="h-4 w-4 text-primary" />
        <p className="mt-2 font-mono text-2xl font-semibold">{value.toLocaleString()}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function QuickLink({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between rounded-md border border-border p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" /> {label}
      </span>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
