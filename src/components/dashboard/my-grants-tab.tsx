"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Coins, Loader2 } from "lucide-react";

interface Grant {
  id: string;
  title: string;
  awardNumber: string | null;
  amount: number | null;
  currency: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  funder: { id: string; name: string } | null;
  department: { id: string; name: string; slug: string } | null;
  article: { id: string; title: string } | null;
}

const STATUS_VARIANT: Record<string, "default" | "outline" | "destructive"> = {
  ACTIVE: "default",
  COMPLETED: "outline",
  CLOSED: "destructive",
};

/**
 * EP University OS Phase 4 — read-only view of the grants where the
 * caller is recorded as principal investigator. Grant records themselves
 * are admin-created (GrantsTab) — a researcher doesn't self-file a grant
 * the way they self-file an ethics submission, so this tab has no form.
 */
export function MyGrantsTab() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<{ grants: Grant[] }>("/api/grants");
        setGrants(res.grants);
      } catch (e: any) {
        toast.error(e.message || "Failed to load grants");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
            <Coins className="h-4 w-4 text-primary" />
            <p className="eyebrow">
              {grants.length} grant{grants.length === 1 ? "" : "s"} where you're PI
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Recorded by your institution's research/grants office. Contact them to update a grant's details.
          </p>
        </CardHeader>
        <CardContent>
          {grants.length === 0 ? (
            <p className="text-xs text-muted-foreground">No grants recorded for you yet.</p>
          ) : (
            <div className="space-y-3">
              {grants.map((g) => (
                <div key={g.id} className="rounded-md border border-border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-base font-semibold">{g.title}</h3>
                    <Badge variant={STATUS_VARIANT[g.status] || "outline"} className="text-[0.6rem]">
                      {g.status}
                    </Badge>
                    {g.awardNumber && (
                      <Badge variant="outline" className="text-[0.6rem]">
                        {g.awardNumber}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {g.funder ? `Funder: ${g.funder.name}` : ""}
                    {g.amount != null ? ` · ${g.currency || ""} ${g.amount.toLocaleString()}` : ""}
                    {g.department ? ` · ${g.department.name}` : ""}
                    {g.article ? ` · re: ${g.article.title}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
