"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Award, Download, Loader2, ShieldCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  CERTIFICATE_TYPES,
  CERTIFICATE_TYPE_LABELS,
  CERTIFICATE_CATEGORIES,
  CERTIFICATE_CATEGORY_LABELS,
  type CertificateType,
  type CertificateCategory,
  type CertificateEligibility,
} from "@/lib/certificates";

interface CertificateSummary {
  id: string;
  type: CertificateType;
  category: CertificateCategory;
  serialNumber: string;
  issuedAt: string;
}

export function CertificatesTab() {
  const [eligibility, setEligibility] = useState<CertificateEligibility | null>(null);
  const [certificates, setCertificates] = useState<CertificateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    setLoading(true);
    apiFetch<{ eligibility: CertificateEligibility; certificates: CertificateSummary[] }>("/api/certificates")
      .then((r) => {
        setEligibility(r.eligibility);
        setCertificates(r.certificates);
      })
      .catch((e: any) => toast.error("Failed to load certificates", { description: e.message }))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function generate(type: CertificateType, category: CertificateCategory, regenerate = false) {
    const key = `${type}:${category}`;
    setBusy(key);
    try {
      const r = await apiFetch<{ url?: string; regenerated?: boolean }>("/api/certificates", {
        method: "POST",
        body: JSON.stringify({ type, category, regenerate }),
      });
      load();
      if (r.url) window.open(r.url, "_blank");
      toast.success(r.regenerated ? `${CERTIFICATE_TYPE_LABELS[type]} updated` : `${CERTIFICATE_TYPE_LABELS[type]} generated`);
    } catch (e: any) {
      toast.error("Failed to generate certificate", { description: e.message });
    } finally {
      setBusy(null);
    }
  }

  async function download(id: string) {
    setBusy(id);
    try {
      const r = await apiFetch<{ url: string }>(`/api/certificates/${id}/download`);
      window.open(r.url, "_blank");
    } catch (e: any) {
      toast.error("Download failed", { description: e.message });
    } finally {
      setBusy(null);
    }
  }

  if (loading || !eligibility) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const heldCategories = CERTIFICATE_CATEGORIES.filter((c) => eligibility[c]);

  return (
    <div className="space-y-5">
      <Card className="paper-card bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <Award className="mt-1 h-5 w-5 flex-shrink-0 text-primary" />
            <div>
              <p className="font-display text-base font-semibold">Certificates</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Professionally designed, downloadable documents recognizing your role with the journal.
                Each certificate is cryptographically verifiable and tamper-evident — its content hash is
                printed on the document and re-checked at a public verification page, so any alteration
                to a downloaded or printed copy is detectable. Not blockchain-based. If a certificate you
                generated earlier looks out of date, use Regenerate to re-render it with the current
                template and your latest profile photo and published-work title.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {heldCategories.length === 0 && (
        <Card className="paper-card">
          <CardContent className="p-5 text-sm text-muted-foreground">
            No certificates are available yet. Certificates unlock once you have at least one published
            article, or hold a Board of Reviewers or Board of Editors role.
          </CardContent>
        </Card>
      )}

      {heldCategories.map((category) => (
        <Card key={category} className="paper-card">
          <CardContent className="p-5">
            <p className="font-display text-base font-semibold">{CERTIFICATE_CATEGORY_LABELS[category]}</p>
            <Separator className="my-3" />
            <div className="grid gap-3 sm:grid-cols-3">
              {CERTIFICATE_TYPES.map((type) => {
                const existing = certificates.find((c) => c.type === type && c.category === category);
                const key = existing ? existing.id : `${type}:${category}`;
                const isBusy = busy === key || busy === `${type}:${category}`;
                return (
                  <div key={type} className="rounded-md border border-border p-3">
                    <p className="font-display text-sm font-semibold">{CERTIFICATE_TYPE_LABELS[type]}</p>
                    {existing ? (
                      <>
                        <p className="mt-1 text-[0.65rem] text-muted-foreground">
                          Issued {new Date(existing.issuedAt).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })}
                        </p>
                        <p className="mt-0.5 font-mono text-[0.6rem] text-muted-foreground">{existing.serialNumber}</p>
                        <div className="mt-2 flex flex-col gap-1.5">
                          <Button size="sm" className="w-full" onClick={() => download(existing.id)} disabled={isBusy}>
                            {isBusy ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Download className="mr-1.5 h-3 w-3" />}
                            Download PDF
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => generate(type, category, true)}
                            disabled={isBusy}
                          >
                            {isBusy ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1.5 h-3 w-3" />}
                            Regenerate
                          </Button>
                          <Button size="sm" variant="outline" className="w-full" asChild>
                            <a href={`/verify/${existing.serialNumber}`} target="_blank" rel="noreferrer">
                              <ShieldCheck className="mr-1.5 h-3 w-3" /> Verification page
                            </a>
                          </Button>
                        </div>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 w-full"
                        onClick={() => generate(type, category)}
                        disabled={isBusy}
                      >
                        {isBusy ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null} Generate
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
