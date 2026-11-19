"use client";

import { useId, useState } from "react";
import { AlertCircle, CheckCircle2, Copy, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";
import { useApp } from "@/lib/store";
import { useLegalIdentity } from "@/lib/tenant-branding-context";
import { CONTACT_TOPICS, contactTopic, type ContactTopicKey } from "@/lib/contact-topics";

interface ContactFormProps {
  initialTopic?: ContactTopicKey;
  initialSubject?: string;
  initialLink?: string;
  /** Lock the topic picker (dialog opened from a specific CTA). */
  lockTopic?: boolean;
  onTopicChange?: (t: ContactTopicKey) => void;
  onCancel?: () => void;
  onDone?: () => void;
}

interface SentState {
  reference: string;
  responseTime: string;
}

/**
 * The site-wide contact form. Sends through POST /api/contact, which emails
 * the official inbox and acknowledges the sender with a reference number.
 * Used inside ContactDialog and on the /contact page.
 */
export function ContactForm({ initialTopic = "general", initialSubject = "", initialLink = "", lockTopic, onTopicChange, onCancel, onDone }: ContactFormProps) {
  const uid = useId();
  const { user } = useApp();
  const legal = useLegalIdentity();
  const [topicKey, setTopicKey] = useState<ContactTopicKey>(initialTopic);
  const topic = contactTopic(topicKey);
  const [form, setForm] = useState({
    name: user?.fullName ?? "",
    email: user?.email ?? "",
    subject: initialSubject,
    message: "",
    link: initialLink,
    option: "",
    website: "",
  });
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<SentState | null>(null);
  const [copied, setCopied] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const id = (k: string) => `${uid}-${k}`;
  const directEmail = topic.privacyInbox ? legal.privacyEmail : legal.contactEmail;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (topic.options && !form.option) {
      setError(`Please choose: ${topic.options.label}.`);
      return;
    }
    if (!consent) {
      setError("Please tick the box to confirm we may use your details to reply.");
      return;
    }
    setSending(true);
    try {
      const res = await apiFetch<{ reference: string; responseTime: string }>("/api/contact", {
        method: "POST",
        body: JSON.stringify({
          topic: topic.key,
          ...form,
          consent: true,
          pageUrl: typeof window !== "undefined" ? window.location.href : "",
        }),
      });
      setSent({ reference: res.reference, responseTime: res.responseTime });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center" role="status" data-testid="contact-success">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" aria-hidden="true" />
        <p className="font-display text-lg font-semibold">Message sent</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Thank you. We aim to reply {sent.responseTime}. A confirmation with your reference is on its way to <span className="font-medium text-foreground">{form.email}</span>.
        </p>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(sent.reference).then(() => setCopied(true), () => undefined);
          }}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 font-mono text-sm"
          aria-label={`Copy reference ${sent.reference}`}
        >
          {sent.reference}
          {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
        {onDone && (
          <Button variant="outline" size="sm" className="mt-2" onClick={onDone}>
            Close
          </Button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate={false} data-testid="contact-form">
      {!lockTopic && (
        <div className="space-y-1.5">
          <Label htmlFor={id("topic")}>What is it about?</Label>
          <Select
            value={topic.key}
            onValueChange={(v) => {
              setTopicKey(v as ContactTopicKey);
              setForm((f) => ({ ...f, option: "" }));
              onTopicChange?.(v as ContactTopicKey);
            }}
          >
            <SelectTrigger id={id("topic")} className="w-full" data-testid="contact-topic">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTACT_TOPICS.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={id("name")}>Your name</Label>
          <Input id={id("name")} value={form.name} onChange={set("name")} required maxLength={120} autoComplete="name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("email")}>Email</Label>
          <Input id={id("email")} type="email" value={form.email} onChange={set("email")} required maxLength={200} autoComplete="email" />
        </div>
      </div>

      {topic.options && (
        <div className="space-y-1.5">
          <Label htmlFor={id("option")}>{topic.options.label}</Label>
          <Select value={form.option} onValueChange={(v) => setForm((f) => ({ ...f, option: v }))}>
            <SelectTrigger id={id("option")} className="w-full" data-testid="contact-option">
              <SelectValue placeholder="Choose one" />
            </SelectTrigger>
            <SelectContent>
              {topic.options.choices.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={id("subject")}>
          Subject <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input id={id("subject")} value={form.subject} onChange={set("subject")} maxLength={160} />
      </div>

      {topic.wantsLink && (
        <div className="space-y-1.5">
          <Label htmlFor={id("link")}>{topic.linkLabel ?? "Related link (optional)"}</Label>
          <Input id={id("link")} value={form.link} onChange={set("link")} maxLength={500} inputMode="url" placeholder="https://… or DOI" />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={id("message")}>Message</Label>
        <Textarea id={id("message")} value={form.message} onChange={set("message")} required minLength={10} maxLength={5000} rows={6} placeholder={topic.placeholder} />
        <p className="text-right text-[0.7rem] text-muted-foreground" aria-live="off">{form.message.length}/5000</p>
      </div>

      {/* Honeypot: hidden from people, filled in by bots. */}
      <input type="text" name="website" value={form.website} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

      <div className="flex items-start gap-2.5">
        <Checkbox id={id("consent")} checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" data-testid="contact-consent" />
        <Label htmlFor={id("consent")} className="text-xs font-normal leading-relaxed text-muted-foreground">
          I agree that {legal.orgName} may use my name and email to reply to this message, as described in the Privacy Policy.
        </Label>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Prefer email? <a className="text-primary hover:underline" href={`mailto:${directEmail}`}>{directEmail}</a>
        </p>
        <div className="flex gap-2 sm:justify-end">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={sending} data-testid="contact-submit">
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="mr-2 h-4 w-4" aria-hidden="true" />}
            Send message
          </Button>
        </div>
      </div>
    </form>
  );
}
