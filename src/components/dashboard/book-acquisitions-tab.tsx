"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BookOpen, Loader2, ListChecks, CheckCircle2, XCircle, Sparkles, Rocket } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-800",
  UNDER_REVIEW: "bg-amber-100 text-amber-800",
  ACCEPTED: "bg-purple-100 text-purple-800",
  IN_PRODUCTION: "bg-indigo-100 text-indigo-800",
  PUBLISHED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

const ACTIONS: Record<string, { label: string; icon: any }[]> = {
  SUBMITTED: [{ label: "SEND_TO_REVIEW", icon: ListChecks }],
  UNDER_REVIEW: [
    { label: "ACCEPT", icon: CheckCircle2 },
    { label: "REJECT", icon: XCircle },
  ],
  ACCEPTED: [
    { label: "SEND_TO_PRODUCTION", icon: Sparkles },
    { label: "REJECT", icon: XCircle },
  ],
  IN_PRODUCTION: [{ label: "PUBLISH", icon: Rocket }],
};

const ACTION_LABELS: Record<string, string> = {
  SEND_TO_REVIEW: "Send to review",
  ACCEPT: "Accept",
  REJECT: "Reject",
  SEND_TO_PRODUCTION: "Generate EPUB/PDF & send to production",
  PUBLISH: "Publish",
};

export function BookAcquisitionsTab() {
  const [books, setBooks] = useState<any[] | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  async function load() {
    try {
      const res = await apiFetch("/api/books?all=1");
      setBooks(res.books);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function act(bookId: string, action: string) {
    setActingOn(bookId);
    try {
      const res = await apiFetch(`/api/books/${bookId}/workflow`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      if (action === "SEND_TO_PRODUCTION" && res.productionJob?.status !== "COMPLETED") {
        toast.error("Production job did not complete", { description: res.productionJob?.errorMessage || "Check the admin book-jobs panel." });
      } else {
        toast.success(`Book ${action.toLowerCase().replace(/_/g, " ")}`);
      }
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActingOn(null);
    }
  }

  if (!books) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <div>
        <p className="font-display text-lg font-medium">Book acquisitions</p>
        <p className="text-sm text-muted-foreground">Review submitted books, compiled volumes, and move them through production to publication.</p>
      </div>

      {books.length === 0 ? (
        <Card className="paper-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground" />
            <p className="mt-4 font-display text-lg font-medium">No book submissions yet</p>
          </CardContent>
        </Card>
      ) : (
        books.map((b) => (
          <Card key={b.id} className="paper-card">
            <CardContent className="space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-display font-medium">{b.title}</p>
                  <p className="text-xs text-muted-foreground">{b.format.replace(/_/g, " ")} · {b.category} · {b.chapters?.length || 0} chapter(s)</p>
                </div>
                <Badge className={STATUS_BADGE[b.status] || ""}>{b.status.replace(/_/g, " ")}</Badge>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {(ACTIONS[b.status] || []).map(({ label, icon: Icon }) => (
                  <Button
                    key={label}
                    size="sm"
                    variant={label === "REJECT" ? "destructive" : "outline"}
                    disabled={actingOn === b.id}
                    onClick={() => act(b.id, label)}
                  >
                    {actingOn === b.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Icon className="mr-1.5 h-3.5 w-3.5" />}
                    {ACTION_LABELS[label]}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
