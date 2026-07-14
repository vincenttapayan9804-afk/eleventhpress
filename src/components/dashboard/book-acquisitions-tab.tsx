"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { BookOpen, Loader2, ListChecks, CheckCircle2, XCircle, Sparkles, Rocket, DollarSign } from "lucide-react";

const ROYALTY_PLATFORMS = [
  { value: "DRAFT2DIGITAL", label: "Draft2Digital" },
  { value: "INGRAMSPARK", label: "IngramSpark" },
  { value: "AMAZON_KDP", label: "Amazon KDP" },
  { value: "LULU", label: "Lulu" },
  { value: "ALL", label: "All platforms (combined)" },
];

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

function RecordRoyaltyDialog({ book }: { book: any }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    platform: "DRAFT2DIGITAL",
    periodStart: "",
    periodEnd: "",
    unitsSold: "0",
    grossRevenue: "0",
    notes: "",
  });

  async function submit() {
    if (!form.periodStart || !form.periodEnd) {
      toast.error("Period start and end are required");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch(`/api/books/${book.id}/royalties`, {
        method: "POST",
        body: JSON.stringify({
          platform: form.platform,
          periodStart: form.periodStart,
          periodEnd: form.periodEnd,
          unitsSold: parseInt(form.unitsSold, 10) || 0,
          grossRevenue: parseFloat(form.grossRevenue) || 0,
          notes: form.notes || undefined,
        }),
      });
      toast.success("Royalty statement recorded");
      setOpen(false);
      setForm({ platform: "DRAFT2DIGITAL", periodStart: "", periodEnd: "", unitsSold: "0", grossRevenue: "0", notes: "" });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <DollarSign className="mr-1.5 h-3.5 w-3.5" /> Record royalty statement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record a royalty statement — {book.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Platform</Label>
            <Select value={form.platform} onValueChange={(v) => setForm((f) => ({ ...f, platform: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROYALTY_PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Period start</Label>
              <Input type="date" value={form.periodStart} onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))} />
            </div>
            <div>
              <Label>Period end</Label>
              <Input type="date" value={form.periodEnd} onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Units sold</Label>
              <Input type="number" min="0" step="1" value={form.unitsSold} onChange={(e) => setForm((f) => ({ ...f, unitsSold: e.target.value }))} />
            </div>
            <div>
              <Label>Gross revenue (USD)</Label>
              <Input type="number" min="0" step="0.01" value={form.grossRevenue} onChange={(e) => setForm((f) => ({ ...f, grossRevenue: e.target.value }))} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Author's share: {book.royaltySharePercent ?? 70}% — transcribe figures from the platform's own sales dashboard.
          </p>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
                {b.status === "PUBLISHED" && <RecordRoyaltyDialog book={b} />}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
