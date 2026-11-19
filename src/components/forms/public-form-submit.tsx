"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Send, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useApp } from "@/lib/store";
import { formById } from "@/lib/forms";
import { isAnonymous, validateFormAnswers } from "@/lib/forms/validate";
import type { FormAnswers } from "@/lib/forms/types";
import { Button } from "@/components/ui/button";
import { OfficialFormFields, FormSignature } from "./official-form-fields";

/**
 * The online edition of a public Official Form (complaints, concerns,
 * correction and data-privacy requests), on the form's own page. Works
 * signed in or not; EP-F-24 can be sent anonymously.
 */
export function PublicFormSubmit({ formId }: { formId: string }) {
  const doc = formById(formId);
  const { user } = useApp();
  const [answers, setAnswers] = useState<FormAnswers>(() => (user?.email ? { contactEmail: user.email } : {}));
  const [signedName, setSignedName] = useState(user?.fullName ?? "");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ reference: string } | null>(null);
  if (!doc) return null;
  const anonymous = isAnonymous(doc, answers);

  async function submit() {
    if (!doc) return;
    const check = validateFormAnswers(doc, answers, signedName);
    if (!check.ok) {
      toast.error("Please complete the form", { description: check.error });
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch<{ reference: string }>(`/api/forms/${doc.id}`, {
        method: "POST",
        body: JSON.stringify({ answers: check.answers, signedName: check.signedName }),
      });
      setDone({ reference: res.reference });
      if (typeof window !== "undefined") document.getElementById("submit")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e: any) {
      toast.error(`Could not send ${doc.code}`, { description: e.message });
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-6 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100">
        <p className="flex items-center gap-2 font-display text-xl font-semibold">
          <CheckCircle2 className="h-5 w-5" /> Received
        </p>
        <p className="mt-2 text-sm leading-relaxed">
          Thank you. Your {doc.title.toLowerCase()} has been sent to the editors. Your reference is{" "}
          <span className="font-mono font-semibold">{done.reference}</span>.
          {anonymous ? " Because it was sent anonymously, we cannot reply to you." : " An acknowledgement has been sent to your email address."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border shadow-sm">
      <div className="bg-gradient-to-br from-[#2a1458] to-[var(--royal-600,#4c1d95)] px-6 py-5 text-white">
        <p className="text-[0.66rem] font-bold uppercase tracking-[0.18em] text-[#e2c785]">Submit online · {doc.code}</p>
        <h2 className="mt-1 font-display text-2xl font-semibold">{doc.title}</h2>
        <p className="mt-1 flex items-start gap-1.5 text-sm text-white/80">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#e2c785]" />
          Sent securely to the editors only. {user ? "You are signed in; a copy is kept under Dashboard → Official forms." : "No account is needed."}
        </p>
      </div>
      <div className="space-y-6 p-5 sm:p-7">
        <OfficialFormFields doc={doc} answers={answers} onChange={setAnswers} />
        {!anonymous && <FormSignature doc={doc} value={signedName} onChange={setSignedName} />}
        <div className="flex justify-end">
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
            Send {doc.code}
          </Button>
        </div>
      </div>
    </div>
  );
}
