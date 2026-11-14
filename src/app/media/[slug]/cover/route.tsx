import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { loadOgFonts, OG_SIZE } from "@/lib/og-card";
import { getMediaStory, MEDIA_STORIES } from "@/lib/media/stories";

/**
 * GET /media/<slug>/cover — the story's cover graphic (1200×630 PNG): an
 * original data card with the story's headline number, what it measures and
 * its source. Used as the hero image, the Media list thumbnail and the
 * social-share image, so every cover is our own and needs no licence.
 */

export const dynamic = "force-static";

export function generateStaticParams() {
  return MEDIA_STORIES.map((s) => ({ slug: s.slug }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const story = getMediaStory(slug);
  if (!story) notFound();
  const { stat, statLabel, source, hue } = story.cover;
  const statSize = stat.length > 8 ? 120 : stat.length > 5 ? 150 : 190;
  const kind = story.type === "NEWS" ? "News" : "Blog";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 72px",
          background: `linear-gradient(135deg, hsl(${hue}, 55%, 12%) 0%, hsl(${hue}, 50%, 22%) 55%, hsl(${(hue + 40) % 360}, 45%, 32%) 100%)`,
          color: "#ffffff",
          fontFamily: "Inter",
          position: "relative",
        }}
      >
        {/* Concentric rings: a quiet, data-chart motif behind the number. */}
        <div style={{ position: "absolute", right: -160, top: -160, width: 620, height: 620, borderRadius: 9999, border: `2px solid hsla(${hue}, 70%, 75%, 0.18)`, display: "flex" }} />
        <div style={{ position: "absolute", right: -60, top: -60, width: 420, height: 420, borderRadius: 9999, border: `2px solid hsla(${hue}, 70%, 75%, 0.22)`, display: "flex" }} />
        <div style={{ position: "absolute", right: 40, top: 40, width: 220, height: 220, borderRadius: 9999, background: `hsla(${hue}, 70%, 70%, 0.12)`, display: "flex" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 44, height: 4, background: `hsl(${hue}, 80%, 78%)` }} />
          <div style={{ fontSize: 24, letterSpacing: 6, textTransform: "uppercase", color: `hsl(${hue}, 70%, 88%)` }}>
            {`${kind} · ${story.category}`.slice(0, 48)}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontFamily: "Fraunces", fontSize: statSize, lineHeight: 1, fontWeight: 600, display: "flex" }}>{stat}</div>
          <div style={{ fontSize: 40, lineHeight: 1.2, maxWidth: 900, color: "#f4efff", display: "flex" }}>{statLabel}</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontSize: 22, color: `hsl(${hue}, 40%, 82%)`, display: "flex", maxWidth: 700 }}>{`Source: ${source}`.slice(0, 80)}</div>
          <div style={{ fontSize: 24, letterSpacing: 4, textTransform: "uppercase", display: "flex" }}>Eleventh Press™</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await loadOgFonts(), headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" } }
  );
}
