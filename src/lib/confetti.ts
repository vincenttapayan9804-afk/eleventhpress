"use client";

// ---------------------------------------------------------------------------
// celebrate() — a small, brand-colored confetti burst for genuine success
// moments (a manuscript submission landing, an editorial accept/publish
// decision, a completed peer review). canvas-confetti is canvas-only — no
// WebGL, no CSS filters/backdrop-filter/mask-image — so it doesn't carry the
// Android GPU-compositing corruption risk already fixed elsewhere in this
// app (ambient-mesh, backdrop blur, drop-shadow-on-background-clip-text).
// ---------------------------------------------------------------------------

import confetti from "canvas-confetti";

const BRAND_COLORS = ["#4c1d95", "#c9a55c", "#7c3aed"];

export function celebrate() {
  confetti({
    particleCount: 90,
    spread: 75,
    startVelocity: 40,
    origin: { y: 0.65 },
    colors: BRAND_COLORS,
    disableForReducedMotion: true,
  });
}
