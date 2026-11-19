"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Accessibility, BookOpen, Clock, CreditCard, KeyRound, Mail, MapPin, MessageSquare, Phone, Scale, ShieldAlert, Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ContactForm } from "@/components/contact/contact-form";
import { contactTopic, type ContactTopicKey } from "@/lib/contact-topics";
import { useLegalIdentity, useTenantBranding } from "@/lib/tenant-branding-context";

const QUICK: { key: ContactTopicKey; icon: LucideIcon }[] = [
  { key: "editorial", icon: BookOpen },
  { key: "technical", icon: Wrench },
  { key: "billing", icon: CreditCard },
  { key: "accessibility", icon: Accessibility },
  { key: "integrity", icon: ShieldAlert },
  { key: "privacy", icon: Scale },
  { key: "security", icon: KeyRound },
  { key: "general", icon: MessageSquare },
];

/**
 * /contact: one page with every way to reach the publisher. Picking a
 * topic card retunes the form below it (heading, prompts, extra fields and
 * the inbox it goes to). Contact details come from the tenant's branding,
 * so a whitelabel site shows its own.
 */
export function ContactView() {
  const legal = useLegalIdentity();
  const branding = useTenantBranding();
  const [topic, setTopic] = useState<ContactTopicKey>("general");
  const [formKey, setFormKey] = useState(0);
  const t = contactTopic(topic);
  const emails = [legal.contactEmail, branding.supportEmail, legal.privacyEmail].filter((v, i, a): v is string => !!v && a.indexOf(v) === i);
  const phones = [branding.phone, branding.phoneAlt].filter((v): v is string => !!v);

  function pick(k: ContactTopicKey) {
    setTopic(k);
    setFormKey((n) => n + 1);
    document.getElementById("contact-form-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-border pb-8">
        <p className="eyebrow">Get in touch</p>
        <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">Contact us</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Choose what your message is about and it goes straight to the right person at {legal.orgName}. Every message gets a
          reference number and an emailed confirmation, and you can reply to that email to add anything.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4" role="group" aria-label="Choose a topic">
        {QUICK.map(({ key, icon: Icon }) => {
          const qt = contactTopic(key);
          const active = key === topic;
          return (
            <button
              key={key}
              type="button"
              onClick={() => pick(key)}
              aria-pressed={active}
              data-testid={`contact-quick-${key}`}
              className={`flex min-h-[88px] flex-col items-start gap-2 rounded-md border p-3 text-left text-sm transition-colors ${
                active ? "border-primary bg-primary/5 text-foreground" : "border-border bg-card hover:border-primary/60"
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true" />
              <span className="font-medium leading-snug">{qt.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_280px]">
        <Card id="contact-form-card" className="scroll-mt-24">
          <CardContent className="p-5 sm:p-6">
            <h2 className="font-display text-xl font-semibold">{t.title}</h2>
            <p className="mt-1 mb-5 text-sm text-muted-foreground">{t.intro}</p>
            <ContactForm key={formKey} initialTopic={topic} onTopicChange={setTopic} />
          </CardContent>
        </Card>

        <aside className="space-y-4 text-sm">
          <Card>
            <CardContent className="space-y-3 p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Direct contact</h2>
              {emails.map((e) => (
                <a key={e} href={`mailto:${e}`} className="flex items-center gap-2 break-all hover:text-primary">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /> {e}
                </a>
              ))}
              {phones.map((p) => (
                <a key={p} href={`tel:${p.replace(/[^0-9+]/g, "")}`} className="flex items-center gap-2 hover:text-primary">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /> {p}
                </a>
              ))}
              {legal.location && (
                <p className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> <span className="whitespace-pre-line">{legal.location}</span>
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-5">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Response times
              </h2>
              <ul className="space-y-1.5 text-muted-foreground">
                <li><span className="text-foreground">Editorial, billing, technical:</span> 3 working days</li>
                <li><span className="text-foreground">Security reports:</span> acknowledged in 3 working days</li>
                <li><span className="text-foreground">Accessibility, integrity:</span> 5 working days</li>
                <li><span className="text-foreground">Data rights:</span> within 30 days</li>
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
