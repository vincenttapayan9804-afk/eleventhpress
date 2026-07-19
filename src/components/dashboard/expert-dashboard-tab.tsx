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

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-3">
        <QuickLink icon={FileText} label="My insights" onClick={() => openDashboard("myArticles")} />
        <QuickLink icon={Users} label="Council of Experts' Directory" onClick={() => setView("experts")} />
        <QuickLink icon={ShieldCheck} label="Publication Charter" onClick={() => setView("charter")} />
      </div>
    </div>
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
