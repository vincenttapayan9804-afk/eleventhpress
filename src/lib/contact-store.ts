"use client";
import { create } from "zustand";
import type { ContactTopicKey } from "./contact-topics";

interface ContactOpenOptions {
  /** Prefilled subject line. */
  subject?: string;
  /** Prefilled related link (article URL, DOI, page). */
  link?: string;
}

interface ContactState {
  open: boolean;
  topic: ContactTopicKey;
  subject: string;
  link: string;
  /** Bumped on every open so the form remounts fresh. */
  nonce: number;
  openContact: (topic?: ContactTopicKey, opts?: ContactOpenOptions) => void;
  close: () => void;
}

/** Opens the site-wide ContactDialog (mounted once in the root layout). */
export const useContact = create<ContactState>()((set) => ({
  open: false,
  topic: "general",
  subject: "",
  link: "",
  nonce: 0,
  openContact: (topic = "general", opts) =>
    set((s) => ({ open: true, topic, subject: opts?.subject ?? "", link: opts?.link ?? "", nonce: s.nonce + 1 })),
  close: () => set({ open: false }),
}));

/** Non-hook helper for event handlers outside React components. */
export function openContact(topic?: ContactTopicKey, opts?: ContactOpenOptions) {
  useContact.getState().openContact(topic, opts);
}
