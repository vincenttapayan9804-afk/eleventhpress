import type { LucideIcon } from "lucide-react";

/**
 * Small circular icon badge used inside the article page's Galleys/Share/
 * Listen action buttons — recolors the plain lucide glyph into a soft
 * purple chip (or, on the solid-purple "Download PDF" button, a white chip)
 * so every download/share/listen action reads as one consistent, premium
 * brand treatment instead of default muted-grey icons.
 */
export function IconChip({
  icon: Icon,
  tone = "soft",
  size = "default",
}: {
  icon: LucideIcon;
  tone?: "soft" | "inverted";
  size?: "default" | "sm";
}) {
  const box = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const iconSize = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";
  return (
    <span
      className={`mr-2 flex ${box} shrink-0 items-center justify-center rounded-full ${
        tone === "inverted" ? "bg-white/25 text-white" : "bg-primary/10 text-primary"
      }`}
    >
      <Icon className={iconSize} />
    </span>
  );
}
