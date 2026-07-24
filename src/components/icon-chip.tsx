import type { LucideIcon } from "lucide-react";

/**
 * Small circular icon badge used inside the article page's Galleys/Share/
 * Listen action buttons — recolors the plain lucide glyph into a solid-fill
 * purple chip (or, on the solid-purple "Download PDF" button, a solid white
 * chip) so every download/share/listen action reads as one consistent,
 * premium brand treatment instead of default muted-grey icons. Solid fills
 * are used deliberately rather than a translucent tint — a `bg-primary/10`
 * wash is too close to the card's own off-white background to read as a
 * chip at a glance.
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
  const box = size === "sm" ? "h-5 w-5" : "h-6 w-6";
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  return (
    <span
      className={`mr-2 flex ${box} shrink-0 items-center justify-center rounded-full ${
        tone === "inverted" ? "bg-white text-primary" : "bg-primary text-primary-foreground"
      }`}
    >
      <Icon className={iconSize} />
    </span>
  );
}
