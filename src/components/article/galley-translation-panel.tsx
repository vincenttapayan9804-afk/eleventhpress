"use client";

// ---------------------------------------------------------------------------
// GalleyTranslationPanel — page-scoped, ssr:false, visibility-gated entry
// point for the full-text translation widget. The real fetch/translate
// logic lives in ./galley-translation-panel-impl.tsx and only loads once
// this panel scrolls near the viewport.
// ---------------------------------------------------------------------------

import dynamic from "next/dynamic";
import { LazyOnVisible } from "@/components/lazy-on-visible";

const GalleyTranslationPanelImpl = dynamic(
  () => import("./galley-translation-panel-impl").then((m) => m.GalleyTranslationPanelImpl),
  { ssr: false }
);

export function GalleyTranslationPanel(props: { articleId: string; locale: string; canTranslate: boolean }) {
  return (
    <LazyOnVisible>
      <GalleyTranslationPanelImpl {...props} />
    </LazyOnVisible>
  );
}
