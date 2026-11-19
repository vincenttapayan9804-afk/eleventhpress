"use client";

import { useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useContact } from "@/lib/contact-store";
import { contactTopic } from "@/lib/contact-topics";
import { ContactForm } from "./contact-form";

/**
 * Site-wide contact dialog, mounted once in the root layout so every page
 * (SPA views and server-rendered pages alike) can open it with
 * `openContact("security")` instead of a `mailto:` link.
 *
 * Also opens itself for a `#contact` or `#contact-<topic>` URL hash, so
 * server-rendered pages and emails can link to it without JavaScript of
 * their own.
 */
export function ContactDialog() {
  const { open, topic, subject, link, nonce, close, openContact } = useContact();

  useEffect(() => {
    const fromHash = () => {
      const m = window.location.hash.match(/^#contact(?:-([a-z]+))?$/);
      if (!m) return;
      openContact(contactTopic(m[1] ?? "general").key);
      history.replaceState(null, "", window.location.pathname + window.location.search);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [openContact]);

  const t = contactTopic(topic);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl" data-testid="contact-dialog">
        <DialogHeader>
          <DialogTitle className="font-display">{t.title}</DialogTitle>
          <DialogDescription>{t.intro}</DialogDescription>
        </DialogHeader>
        {open && (
          <ContactForm
            key={nonce}
            initialTopic={topic}
            initialSubject={subject}
            initialLink={link}
            // The form keeps its own state (keyed by nonce); this only retitles the dialog.
            onTopicChange={(k) => useContact.setState({ topic: k })}
            onCancel={close}
            onDone={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
